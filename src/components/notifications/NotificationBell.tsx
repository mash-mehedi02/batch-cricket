import React, { useState, useEffect } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { NotificationSettingsSheet } from './NotificationSettingsSheet'
import { notificationService } from '../../services/notificationService'

interface Props {
    matchId: string
    adminId: string
    matchTitle?: string
    tournamentId?: string
    color?: string
}

export const NotificationBell: React.FC<Props> = ({
    matchId,
    adminId,
    matchTitle,
    tournamentId,
    color = "text-gray-700"
}) => {
    const [showSheet, setShowSheet] = useState(false)
    const [isActive, setIsActive] = useState(false)

    const checkStatus = () => {
        const settings = notificationService.getSettings(matchId)
        // Active if any notification is enabled
        setIsActive(settings.all || settings.wickets || settings.reminders)
    }

    useEffect(() => {
        checkStatus()

        // Listen for changes from other components (e.g. settings sheet)
        const unsubscribe = notificationService.addChangeListener((id, settings) => {
            if (id === matchId) {
                setIsActive(settings.all || settings.wickets || settings.reminders)
            }
        })

        return () => unsubscribe()
    }, [matchId])

    return (
        <>
            <button
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowSheet(true)
                }}
                className={`p-2 rounded-full hover:bg-gray-100 transition-colors relative ${color}`}
                aria-label="Notification Settings"
            >
                {isActive ? (
                    <BellRing size={20} className="text-blue-600" fill="currentColor" fillOpacity={0.2} />
                ) : (
                    <Bell size={20} />
                )}
            </button>

            <NotificationSettingsSheet
                isOpen={showSheet}
                onClose={() => {
                    setShowSheet(false)
                    checkStatus() // Refresh status on close
                }}
                matchId={matchId}
                adminId={adminId}
                matchTitle={matchTitle}
                tournamentId={tournamentId}
            />
        </>
    )
}
