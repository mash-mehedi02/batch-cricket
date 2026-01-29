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

// Cloud Functions
const subscribeToTopicFn = httpsCallable<{ token: string; topic: string }, { success: boolean }>(functions, 'subscribeToTopic')
const unsubscribeFromTopicFn = httpsCallable<{ token: string; topic: string }, { success: boolean }>(functions, 'unsubscribeFromTopic')

class NotificationService {
    private messaging: Messaging | null = messaging
    private token: string | null = null
    private listeners: ((matchId: string, settings: MatchNotificationSettings) => void)[] = []

    constructor() {
        this.messaging = messaging
    }

    /**
     * Subscribe to settings changes
     */
    addChangeListener(listener: (matchId: string, settings: MatchNotificationSettings) => void) {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notifyListeners(matchId: string, settings: MatchNotificationSettings) {
        this.listeners.forEach(l => l(matchId, settings))
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
     * @param matchId 
     * @param settings 
     */
    async updateMatchSubscription(matchId: string, settings: MatchNotificationSettings) {
        if (!this.token) {
            const token = await this.requestPermission()
            if (!token) return
        }

        const topicBase = `match_${matchId}`

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

        // Save preferences locally
        this.saveSettings(matchId, settings)

        toast.success('Notification settings updated')
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
