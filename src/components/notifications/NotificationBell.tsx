import React, { useState, useEffect } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { NotificationSettingsSheet } from './NotificationSettingsSheet'

interface Props {
    matchId: string
    matchTitle?: string
    tournamentId?: string
    color?: string
}

const STORAGE_KEY = 'batchcrick_notifications'
const TOURNAMENT_STORAGE_KEY = 'batchcrick_tournament_notifications'

export const NotificationBell: React.FC<Props> = ({
    matchId,
    matchTitle,
    tournamentId,
    color = "text-gray-700"
}) => {
    const [showSheet, setShowSheet] = useState(false)
    const [isActive, setIsActive] = useState(false)

    const checkStatus = () => {
        const matchStored = localStorage.getItem(STORAGE_KEY)
        const tournamentStored = localStorage.getItem(TOURNAMENT_STORAGE_KEY)

        let matchEnabled = false
        if (matchStored) {
            try {
                const data = JSON.parse(matchStored)
                const matchSettings = data[matchId]
                matchEnabled = matchSettings?.all || matchSettings?.wickets || matchSettings?.reminders || false
            } catch {
                matchEnabled = false
            }
        }

        let tournamentEnabled = false
        if (tournamentStored && tournamentId) {
            try {
                const data = JSON.parse(tournamentStored)
                tournamentEnabled = data[tournamentId] || false
            } catch {
                tournamentEnabled = false
            }
        }

        setIsActive(matchEnabled || tournamentEnabled)
    }

    useEffect(() => {
        checkStatus()

        // Listen for storage changes (from settings sheet)
        const handleStorageChange = () => {
            checkStatus()
        }

        window.addEventListener('storage', handleStorageChange)

        // Also check when sheet closes
        const interval = setInterval(checkStatus, 1000)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            clearInterval(interval)
        }
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
                matchTitle={matchTitle}
                tournamentId={tournamentId}
            />
        </>
    )
}
