import { getToken, onMessage, Messaging } from 'firebase/messaging'
import { httpsCallable } from 'firebase/functions'
import { messaging, functions } from '../config/firebase'
import toast from 'react-hot-toast'

export type NotificationType = 'all' | 'wickets' | 'reminders'

interface MatchNotificationSettings {
    all: boolean
    wickets: boolean
    reminders: boolean
}

const STORAGE_KEY = 'batchcrick_notifications'
const TOURNAMENT_STORAGE_KEY = 'batchcrick_tournament_notifications'

// Cloud Functions
const subscribeToTopicFn = httpsCallable<{ token: string; topic: string }, { success: boolean }>(functions, 'subscribeToTopic')
const unsubscribeFromTopicFn = httpsCallable<{ token: string; topic: string }, { success: boolean }>(functions, 'unsubscribeFromTopic')

class NotificationService {
    private messaging: Messaging | null = messaging
    private token: string | null = null
    private listeners: ((id: string, settings: any) => void)[] = []

    constructor() {
        this.messaging = messaging
    }

    /**
     * Subscribe to settings changes
     */
    addChangeListener(listener: (id: string, settings: any) => void) {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notifyListeners(id: string, settings: any) {
        this.listeners.forEach(l => l(id, settings))
    }

    /**
     * Request notification permission and get token
     */
    async requestPermission(): Promise<string | null> {
        if (!this.messaging) return null

        try {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
                const token = await getToken(this.messaging, {
                    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
                })
                this.token = token
                return token
            } else {
                console.warn('Notification permission denied')
                return null
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error)
            return null
        }
    }

    /**
     * Subscribe to match notifications
     */
    async updateMatchSubscription(matchId: string, adminId: string, settings: MatchNotificationSettings) {
        // Save preferences locally first to ensure UI consistency
        this.saveSettings(matchId, settings)

        // Check if any notification is enabled
        const anyEnabled = settings.all || settings.wickets || settings.reminders

        if (!anyEnabled) {
            // User is disabling all notifications, no need for token
            const topicBase = `admin_${adminId}_match_${matchId}`
            if (this.token) {
                await this.unsubscribe(`${topicBase}_reminders`)
                await this.unsubscribe(`${topicBase}_wickets`)
            }
            toast.success('Match notifications disabled')
            return
        }

        // User wants to enable notifications - ensure we have permission
        if (!this.token) {
            const token = await this.requestPermission()
            if (!token) {
                // Permission denied - revert settings
                this.saveSettings(matchId, { all: false, wickets: false, reminders: false })
                toast.error('Please allow notifications in your browser settings')
                return
            }
        }

        const topicBase = `admin_${adminId}_match_${matchId}`

        // Topics
        const topicReminders = `${topicBase}_reminders`
        const topicWickets = `${topicBase}_wickets`

        // Reminders (Toss, Start, Result)
        if (settings.reminders || settings.all) {
            await this.subscribe(topicReminders)
        } else {
            await this.unsubscribe(topicReminders)
        }

        // Wickets
        if (settings.wickets || settings.all) {
            await this.subscribe(topicWickets)
        } else {
            await this.unsubscribe(topicWickets)
        }

        toast.success('Match notification settings updated')
    }

    /**
     * Subscribe to tournament notifications
     */
    async updateTournamentSubscription(tournamentId: string, adminId: string, enabled: boolean) {
        if (!this.token) {
            const token = await this.requestPermission()
            if (!token) return
        }

        const topic = `admin_${adminId}_tournament_${tournamentId}_updates`

        if (enabled) {
            await this.subscribe(topic)
        } else {
            await this.unsubscribe(topic)
        }

        // Save preferences locally
        const stored = localStorage.getItem(TOURNAMENT_STORAGE_KEY)
        const data = stored ? JSON.parse(stored) : {}
        data[tournamentId] = enabled
        localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(data))

        this.notifyListeners(tournamentId, enabled)
        toast.success(enabled ? 'Subscribed to tournament' : 'Unsubscribed from tournament')
    }

    private async subscribe(topic: string) {
        if (!this.token) return
        try {
            await subscribeToTopicFn({ token: this.token, topic })
        } catch (error) {
            console.error(`Failed to subscribe to ${topic}`, error)
        }
    }

    private async unsubscribe(topic: string) {
        if (!this.token) return
        try {
            await unsubscribeFromTopicFn({ token: this.token, topic })
        } catch (error) {
            console.error(`Failed to unsubscribe from ${topic}`, error)
        }
    }

    getSettings(matchId: string): MatchNotificationSettings {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const data = JSON.parse(stored)
            return data[matchId] || { all: false, wickets: false, reminders: false }
        }
        return { all: false, wickets: false, reminders: false }
    }

    getTournamentSettings(tournamentId: string): boolean {
        const stored = localStorage.getItem(TOURNAMENT_STORAGE_KEY)
        if (stored) {
            const data = JSON.parse(stored)
            return data[tournamentId] || false
        }
        return false
    }

    private saveSettings(matchId: string, settings: MatchNotificationSettings) {
        const stored = localStorage.getItem(STORAGE_KEY)
        const data = stored ? JSON.parse(stored) : {}
        data[matchId] = settings
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        this.notifyListeners(matchId, settings)
    }

    // Handle foreground messages
    onMessage(callback: (payload: any) => void) {
        if (!this.messaging) return () => { }
        return onMessage(this.messaging, callback)
    }
}

export const notificationService = new NotificationService()
