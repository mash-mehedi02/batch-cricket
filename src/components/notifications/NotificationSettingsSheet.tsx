import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { oneSignalService } from '../../services/oneSignalService'
import toast from 'react-hot-toast'

interface Props {
    isOpen: boolean
    onClose: () => void
    matchId: string
    adminId: string
    matchTitle?: string
    tournamentId?: string
}

const STORAGE_KEY = 'batchcrick_onesignal_notifications'

export const NotificationSettingsSheet: React.FC<Props> = ({
    isOpen,
    onClose,
    matchId,
    adminId,
    matchTitle = "Match",
    tournamentId
}) => {
    const [settings, setSettings] = useState({
        enabled: false,
        tournament: false
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            loadSettings()
        }
    }, [isOpen, matchId, tournamentId])

    const loadSettings = () => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            try {
                const data = JSON.parse(stored)
                const matchEnabled = data.matches?.[matchId] || false
                const tournamentEnabled = tournamentId ? (data.tournaments?.[tournamentId] || false) : false
                setSettings({
                    enabled: matchEnabled,
                    tournament: tournamentEnabled
                })
            } catch {
                setSettings({ enabled: false, tournament: false })
            }
        }
    }

    const saveSettings = (matchEnabled: boolean, tournamentEnabled: boolean) => {
        const stored = localStorage.getItem(STORAGE_KEY)
        let data: any = {}
        if (stored) {
            try {
                data = JSON.parse(stored)
            } catch {
                data = {}
            }
        }

        if (!data.matches) data.matches = {}
        if (!data.tournaments) data.tournaments = {}

        data.matches[matchId] = matchEnabled
        if (tournamentId) {
            data.tournaments[tournamentId] = tournamentEnabled
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }

    const handleToggleMatch = async () => {
        console.log('[NotificationSettingsSheet] Toggling match:', matchId, 'Current state:', settings.enabled);
        setLoading(true)
        try {
            const newValue = !settings.enabled

            if (newValue) {
                // Enable notifications
                const subscribed = await oneSignalService.isSubscribed()
                console.log('[NotificationSettingsSheet] isSubscribed:', subscribed);

                if (!subscribed) {
                    const permitted = await oneSignalService.requestPermission()
                    console.log('[NotificationSettingsSheet] Permission granted:', permitted);

                    if (!permitted) {
                        toast.error('Notification permission denied or blocked')
                        setLoading(false)
                        return
                    }
                }

                console.log('[NotificationSettingsSheet] Subscribing to match...');
                await oneSignalService.subscribeToMatch(matchId)
                toast.success('Match notifications enabled')
            } else {
                // Disable notifications
                console.log('[NotificationSettingsSheet] Unsubscribing from match...');
                await oneSignalService.unsubscribeFromMatch(matchId)
                toast.success('Match notifications disabled')
            }

            setSettings(prev => ({ ...prev, enabled: newValue }))
            saveSettings(newValue, settings.tournament)
        } catch (error: any) {
            console.error('[NotificationSettingsSheet] Failed to toggle match notifications:', error)

            const errMsg = error?.message || '';
            if (errMsg.includes('AbortError') || errMsg.includes('Registration failed')) {
                toast.error('Push Registration Failed. Please disable Ad-blockers or check your connection.', { duration: 5000 })
            } else {
                toast.error('Failed to update notifications')
            }

            // Revert UI state on error
            loadSettings()
        } finally {
            setLoading(false)
        }
    }

    const handleToggleTournament = async () => {
        if (!tournamentId) return
        console.log('[NotificationSettingsSheet] Toggling tournament:', tournamentId, 'Current state:', settings.tournament);

        setLoading(true)
        try {
            const newValue = !settings.tournament

            if (newValue) {
                const subscribed = await oneSignalService.isSubscribed()
                if (!subscribed) {
                    const permitted = await oneSignalService.requestPermission()
                    if (!permitted) {
                        toast.error('Notification permission denied or blocked')
                        setLoading(false)
                        return
                    }
                }

                console.log('[NotificationSettingsSheet] Subscribing to tournament...');
                await oneSignalService.subscribeToTournament(tournamentId, adminId)
                toast.success('Tournament notifications enabled')
            } else {
                console.log('[NotificationSettingsSheet] Unsubscribing from tournament...');
                await oneSignalService.unsubscribeFromTournament(tournamentId, adminId)
                toast.success('Tournament notifications disabled')
            }

            setSettings(prev => ({ ...prev, tournament: newValue }))
            saveSettings(settings.enabled, newValue)
        } catch (error) {
            console.error('[NotificationSettingsSheet] Failed to toggle tournament notifications:', error)
            toast.error('Failed to update notifications')
        } finally {
            setLoading(false)
        }
    }

    const Toggle = ({
        label,
        subtitle,
        checked,
        onChange,
        disabled
    }: {
        label: string,
        subtitle: string,
        checked: boolean,
        onChange: () => void,
        disabled?: boolean
    }) => (
        <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
            <div className="flex flex-col">
                <span className="text-gray-900 font-medium text-[15px]">{label}</span>
                <span className="text-gray-500 text-xs mt-0.5">{subtitle}</span>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onChange();
                }}
                disabled={disabled}
                className={`w-12 h-7 rounded-full transition-colors duration-200 ease-in-out relative ${checked ? 'bg-blue-600' : 'bg-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    )

    if (typeof document === 'undefined') return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0" style={{ zIndex: 1000000 }}>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        className="absolute inset-0 bg-black"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] shadow-2xl max-w-md mx-auto overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg leading-tight text-left">Manage Notifications</h3>
                                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider text-left mt-1">{matchTitle}</p>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors border border-gray-100 shadow-sm"
                            >
                                <X size={20} className="text-gray-600" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-2 pb-10">
                            <Toggle
                                label="Match Notifications"
                                subtitle="Get notified about wickets, milestones & match updates"
                                checked={settings.enabled}
                                onChange={handleToggleMatch}
                                disabled={loading}
                            />
                            {tournamentId && (
                                <Toggle
                                    label="Tournament Notifications"
                                    subtitle="All matches in this entire tournament"
                                    checked={settings.tournament}
                                    onChange={handleToggleTournament}
                                    disabled={loading}
                                />
                            )}

                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
