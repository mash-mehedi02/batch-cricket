import React, { useState, useEffect } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { NotificationSettingsSheet } from './NotificationSettingsSheet'

interface Props {
    matchId: string
    adminId: string
    matchTitle?: string
    tournamentId?: string
    color?: string
}

const STORAGE_KEY = 'batchcrick_onesignal_notifications'

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
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            try {
                const data = JSON.parse(stored)
                const matchEnabled = data.matches?.[matchId] || false
                setIsActive(matchEnabled)
            } catch {
                setIsActive(false)
            }
        } else {
            setIsActive(false)
        }
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
                adminId={adminId}
                matchTitle={matchTitle}
                tournamentId={tournamentId}
            />
        </>
    )
}
