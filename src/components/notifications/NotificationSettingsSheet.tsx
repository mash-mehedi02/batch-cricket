import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, BellRing, Check } from 'lucide-react'
import { notificationService } from '../../services/notificationService'

interface Props {
    isOpen: boolean
    onClose: () => void
    matchId: string
    matchTitle?: string
}

export const NotificationSettingsSheet: React.FC<Props> = ({
    isOpen,
    onClose,
    matchId,
    matchTitle = "Match"
}) => {
    const [settings, setSettings] = useState({
        all: false,
        wickets: false,
        reminders: false
    })

    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen) {
            const current = notificationService.getSettings(matchId)
            setSettings(current)
        }
    }, [isOpen, matchId])

    const handleToggle = (key: keyof typeof settings) => {
        const newSettings = { ...settings }

        if (key === 'all') {
            const newValue = !settings.all
            newSettings.all = newValue
            newSettings.wickets = newValue
            newSettings.reminders = newValue
        } else {
            newSettings[key] = !settings[key]

            // If toggling individual off, turn off 'all'
            if (!newSettings[key]) {
                newSettings.all = false
            }
            // If all individuals are on, turn on 'all'
            else if (newSettings.wickets && newSettings.reminders) {
                newSettings.all = true
            }
        }
        setSettings(newSettings)
    }

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setLoading(true)
        await notificationService.updateMatchSubscription(matchId, settings)
        setLoading(false)
        onClose()
    }

    // Toggle Component
    const Toggle = ({
        label,
        subtitle,
        checked,
        onChange
    }: {
        label: string,
        subtitle: string,
        checked: boolean,
        onChange: () => void
    }) => (
        <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
            <div className="flex flex-col">
                <span className="text-gray-900 font-medium text-[15px]">{label}</span>
                <span className="text-gray-500 text-xs mt-0.5">{subtitle}</span>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onChange();
                }}
                className={`w-12 h-7 rounded-full transition-colors duration-200 ease-in-out relative ${checked ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
            >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`} />
            </button>
        </div>
    )

    return (
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
                        className="fixed inset-0 bg-black z-50"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-2xl shadow-xl max-w-md mx-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900 text-lg">Manage Notifications</h3>
                            <button
                                onClick={(e) => handleSave(e)}
                                disabled={loading}
                                className="text-blue-600 font-semibold text-sm hover:text-blue-700"
                            >
                                {loading ? 'Saving...' : 'Done'}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-5 py-2 pb-8">
                            <Toggle
                                label="All Notifications"
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
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
