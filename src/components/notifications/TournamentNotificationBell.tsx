import React, { useState, useEffect } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { notificationService } from '../../services/notificationService'

interface Props {
    tournamentId: string
    tournamentName?: string
    color?: string
}

export const TournamentNotificationBell: React.FC<Props> = ({
    tournamentId,
    tournamentName,
    color = "text-gray-700"
}) => {
    const [isActive, setIsActive] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setIsActive(notificationService.getTournamentSettings(tournamentId))

        const unsubscribe = notificationService.addChangeListener((id, settings) => {
            if (id === tournamentId) {
                setIsActive(!!settings)
            }
        })

        return () => unsubscribe()
    }, [tournamentId])

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        setLoading(true)
        try {
            await notificationService.updateTournamentSubscription(tournamentId, !isActive)
            setIsActive(!isActive)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleToggle}
            disabled={loading}
            className={`p-2 rounded-xl transition-all relative flex items-center gap-2 font-black uppercase tracking-widest text-[10px] sm:text-xs ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Tournament Notification Settings"
        >
            {isActive ? (
                <>
                    <BellRing size={16} fill="currentColor" fillOpacity={0.2} />
                    <span>Subscribed</span>
                </>
            ) : (
                <>
                    <Bell size={16} />
                    <span>Notify Me</span>
                </>
            )}
        </button>
    )
}
