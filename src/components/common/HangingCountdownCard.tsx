/**
 * Hanging Countdown Card
 * exact same "TIME REMAINING" design but sized for the hero section
 */

import { useState, useEffect, useRef } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'

interface CountdownPopupConfig {
    enabled: boolean
    tournamentName: string
    tournamentLogo: string
    startDate: string
}

export default function HangingCountdownCard() {
    const [config, setConfig] = useState<CountdownPopupConfig | null>(null)
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, 'settings', 'countdownPopup')
                const snap = await getDoc(docRef)
                if (snap.exists()) {
                    const data = snap.data() as CountdownPopupConfig
                    if (data.enabled && data.tournamentName && data.startDate) {
                        setConfig(data)
                    }
                }
            } catch (err) {
                console.warn('[HangingCountdown] Failed to fetch config:', err)
            }
        }
        fetchConfig()
    }, [])

    useEffect(() => {
        if (!config?.startDate) return

        const calcTimeLeft = () => {
            const target = new Date(config.startDate + 'T00:00:00').getTime()
            const now = Date.now()
            const diff = Math.max(0, target - now)

            return {
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((diff / (1000 * 60)) % 60),
                seconds: Math.floor((diff / 1000) % 60),
            }
        }

        setTimeLeft(calcTimeLeft())
        intervalRef.current = setInterval(() => {
            setTimeLeft(calcTimeLeft())
        }, 1000)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [config?.startDate])

    if (!config) return null

    const DigitCard = ({ value, color }: { value: string, color: string }) => (
        <div style={{
            position: 'relative',
            width: '18px',
            height: '24px',
            background: color,
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            overflow: 'hidden'
        }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '0.5px', background: 'rgba(0,0,0,0.2)', zIndex: 2 }} />
            {value}
        </div>
    )

    const TimeUnit = ({ value, label, color }: { value: number, label: string, color: string }) => {
        const str = String(value).padStart(2, '0')
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                    <DigitCard value={str[0]} color={color} />
                    <DigitCard value={str[1]} color={color} />
                </div>
                <div style={{ fontSize: '6px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{label}</div>
            </div>
        )
    }

    return (
        <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-30px',
            zIndex: 15,
            transformOrigin: 'top center',
            animation: 'hangingSwing 6s ease-in-out infinite alternate',
        }}>
            {/* Strings */}
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 15px' }}>
                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
            </div>

            {/* Exact Reference Card (Smaller) */}
            <div style={{
                background: '#2b3945',
                borderRadius: '12px',
                padding: '8px 10px 6px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                textAlign: 'center',
            }}>
                {/* Title Section */}
                <div style={{ position: 'relative', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', left: 0, top: '50%', width: '10px', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
                    <div style={{ position: 'absolute', right: 0, top: '50%', width: '10px', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
                    <span style={{
                        fontSize: '6px',
                        fontWeight: 900,
                        color: '#fff',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        background: '#2b3945',
                        padding: '0 4px',
                        zIndex: 1
                    }}>
                        Time Remaining
                    </span>
                </div>

                {/* Units */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '4px' }}>
                    <TimeUnit value={timeLeft.days} label="Days" color="#f59e0b" />
                    <div style={{ marginTop: '5px', fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.2)' }}>:</div>
                    <TimeUnit value={timeLeft.hours} label="Hours" color="#84cc16" />
                    <div style={{ marginTop: '5px', fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.2)' }}>:</div>
                    <TimeUnit value={timeLeft.minutes} label="Mins" color="#ef4444" />
                </div>
            </div>

            <style>{`
                @keyframes hangingSwing {
                    0% { transform: rotate(-1.5deg); }
                    100% { transform: rotate(1.5deg); }
                }
            `}</style>
        </div>
    )
}
