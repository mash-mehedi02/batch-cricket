import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { notificationService } from '../../services/notificationService'

interface Props {
    isOpen: boolean
    onClose: () => void
    matchId: string
    adminId: string
    matchTitle?: string
    tournamentId?: string
}

export const NotificationSettingsSheet: React.FC<Props> = ({
    isOpen,
    onClose,
    matchId,
    adminId,
    matchTitle = "Match",
    tournamentId
}) => {
    const [settings, setSettings] = useState({
        all: false,
        wickets: false,
        reminders: false,
        tournament: false
    })

    useEffect(() => {
        if (isOpen) {
            const current = notificationService.getSettings(matchId)
            const tournamentEnabled = tournamentId ? notificationService.getTournamentSettings(tournamentId) : false
            setSettings({
                ...current,
                tournament: tournamentEnabled
            })
        }
    }, [isOpen, matchId, tournamentId])

    const handleToggle = async (key: keyof typeof settings) => {
        const newSettings = { ...settings }

        if (key === 'all') {
            const newValue = !settings.all
            newSettings.all = newValue
            newSettings.wickets = newValue
            newSettings.reminders = newValue
            if (newValue && tournamentId) {
                newSettings.tournament = true
                await notificationService.updateTournamentSubscription(tournamentId, adminId, true)
            }
        } else if (key === 'tournament') {
            newSettings.tournament = !settings.tournament
            if (tournamentId) {
                await notificationService.updateTournamentSubscription(tournamentId, adminId, newSettings.tournament)
            }
        } else {
            newSettings[key] = !settings[key]
            if (!newSettings[key]) {
                newSettings.all = false
            } else if (newSettings.wickets && newSettings.reminders) {
                newSettings.all = true
            }
        }
        setSettings(newSettings)

        if (key === 'tournament') return

        await notificationService.updateMatchSubscription(matchId, adminId, {
            all: newSettings.all,
            wickets: newSettings.wickets,
            reminders: newSettings.reminders
        })
    }

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
                className={`w-12 h-7 rounded-full transition-colors duration-200 ease-in-out relative ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
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
                                label="All Notifications"
                                subtitle="Wickets, 50s, 100s & Match Reminders"
                                checked={settings.all}
                                onChange={() => handleToggle('all')}
                            />
                            <Toggle
                                label="Wicket Notifications"
                                subtitle="All wicket updates for this Match"
                                checked={settings.wickets}
                                onChange={() => handleToggle('wickets')}
                            />
                            <Toggle
                                label="Match Reminders"
                                subtitle="Toss, Innings Start & Match Result"
                                checked={settings.reminders}
                                onChange={() => handleToggle('reminders')}
                            />
                            {tournamentId && (
                                <Toggle
                                    label="Tournament Notifications"
                                    subtitle="All matches in this entire tournament"
                                    checked={settings.tournament}
                                    onChange={() => handleToggle('tournament')}
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
