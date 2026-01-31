import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { notificationService } from '../../services/notificationService'

interface Props {
    isOpen: boolean
    onClose: () => void
    matchId: string
    tournamentId?: string
    tournamentName?: string
}

export const NotificationSettingsSheet: React.FC<Props> = ({
    isOpen,
    onClose,
    matchId,
    tournamentId,
    tournamentName
}) => {
    const [settings, setSettings] = useState({
        all: false,
        wickets: false,
        reminders: false
    })

    const [isTournamentSubscribed, setIsTournamentSubscribed] = useState(false)

    useEffect(() => {
        if (isOpen) {
            const current = notificationService.getSettings(matchId)
            setSettings(current)

            if (tournamentId) {
                setIsTournamentSubscribed(notificationService.getTournamentSettings(tournamentId))
            }
        }
    }, [isOpen, matchId, tournamentId])

    const updateMatchSettings = async (newSettings: typeof settings) => {
        setSettings(newSettings)
        await notificationService.updateMatchSubscription(matchId, newSettings)
    }

    const handleToggle = (key: keyof typeof settings) => {
        const newSettings = { ...settings }
        let shouldEnableTournament = false

        if (key === 'all') {
            const newValue = !settings.all
            newSettings.all = newValue
            newSettings.wickets = newValue
            newSettings.reminders = newValue

            if (newValue && tournamentId) shouldEnableTournament = true
        } else {
            newSettings[key] = !settings[key]

            if (!newSettings[key]) {
                newSettings.all = false
            } else if (newSettings.wickets && newSettings.reminders) {
                newSettings.all = true
                if (tournamentId) shouldEnableTournament = true
            }
        }

        updateMatchSettings(newSettings)

        if (shouldEnableTournament && !isTournamentSubscribed) {
            handleTournamentToggle(true)
        }
    }

    const handleTournamentToggle = async (forceState?: boolean) => {
        const newState = forceState !== undefined ? forceState : !isTournamentSubscribed
        setIsTournamentSubscribed(newState)
        if (tournamentId) {
            await notificationService.updateTournamentSubscription(tournamentId, newState)
        }
    }

    // Toggle Component
    const Toggle = ({
        label,
        subtitle,
        checked,
        onChange,
        highlight = false
    }: {
        label: string,
        subtitle: string,
        checked: boolean,
        onChange: () => void,
        highlight?: boolean
    }) => (
        <div className={`flex items-center justify-between py-4 border-b border-gray-100 last:border-0 ${highlight ? 'bg-amber-50/50 -mx-5 px-5 border-amber-100' : ''}`}>
            <div className="flex flex-col">
                <span className={`font-medium text-[15px] ${highlight ? 'text-amber-900' : 'text-gray-900'}`}>{label}</span>
                <span className={`text-xs mt-0.5 ${highlight ? 'text-amber-700' : 'text-gray-500'}`}>{subtitle}</span>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onChange();
                }}
                className={`w-12 h-7 rounded-full transition-colors duration-200 ease-in-out relative ${checked ? (highlight ? 'bg-amber-500' : 'bg-blue-600') : 'bg-gray-200'
                    }`}
            >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`} />
            </button>
        </div>
    )

    if (typeof document === 'undefined') return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
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
                        className="fixed inset-0 bg-black z-[150]"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="fixed bottom-0 left-0 right-0 bg-white z-[150] rounded-t-2xl shadow-xl max-w-md mx-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900 text-lg">Manage Notifications</h3>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-5 py-2 pb-8">
                            <Toggle
                                label="All Notifications (This Match)"
                                subtitle="Wickets, 50s, 100s & Match Reminders"
                                checked={settings.all}
                                onChange={() => handleToggle('all')}
                            />
                            <Toggle
                                label="Wicket Notifications"
                                subtitle="All wicket updates for Match"
                                checked={settings.wickets}
                                onChange={() => handleToggle('wickets')}
                            />
                            <Toggle
                                label="Match Reminders"
                                subtitle="Toss, Inns Start & Result"
                                checked={settings.reminders}
                                onChange={() => handleToggle('reminders')}
                            />

                            {tournamentId && (
                                <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                                    <Toggle
                                        label={`Get all updates for ${tournamentName || 'Tournament'}`}
                                        subtitle="Auto-notify for all matches in this tournament"
                                        checked={isTournamentSubscribed}
                                        onChange={handleTournamentToggle}
                                        highlight={true}
                                    />
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    )
}
