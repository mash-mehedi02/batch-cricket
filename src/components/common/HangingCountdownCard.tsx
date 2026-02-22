/**
 * Hanging Countdown Card
 * exact same "TIME REMAINING" design but sized for the hero section
 * REAL FLIP-CLOCK ANIMATION Logic (Improved Visibility)
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

const FlipDigit = ({ digit, color }: { digit: string, color: string }) => {
    const [displayDigit, setDisplayDigit] = useState(digit)
    const [nextDigit, setNextDigit] = useState(digit)
    const [isFlipping, setIsFlipping] = useState(false)

    useEffect(() => {
        if (digit !== nextDigit) {
            setNextDigit(digit)
            setIsFlipping(true)

            const timer = setTimeout(() => {
                setDisplayDigit(digit)
                setIsFlipping(false)
            }, 800)
            return () => clearTimeout(timer)
        }
    }, [digit, nextDigit])

    const commonStyle: React.CSSProperties = {
        position: 'absolute',
        left: 0,
        width: '100%',
        height: '50%',
        overflow: 'hidden',
        background: color,
        color: '#fff',
        fontSize: '12px',
        fontWeight: '900',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
    }

    const topStyle: React.CSSProperties = {
        ...commonStyle,
        top: 0,
        alignItems: 'flex-end',
        borderTopLeftRadius: '3px',
        borderTopRightRadius: '3px',
        borderBottom: '0.5px solid rgba(0,0,0,0.15)',
    }

    const bottomStyle: React.CSSProperties = {
        ...commonStyle,
        bottom: 0,
        alignItems: 'flex-start',
        borderBottomLeftRadius: '3px',
        borderBottomRightRadius: '3px',
    }

    return (
        <div style={{
            position: 'relative',
            width: '16px',
            height: '24px',
            perspective: '100px',
            borderRadius: '3px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            background: 'rgba(0,0,0,0.2)',
        }}>
            <div style={{ ...topStyle, zIndex: 1 }}>
                <span style={{ transform: 'translateY(50%)' }}>{nextDigit}</span>
            </div>
            <div style={{ ...bottomStyle, zIndex: 1 }}>
                <span style={{ transform: 'translateY(-50%)' }}>{displayDigit}</span>
            </div>
            <div style={{
                ...topStyle,
                zIndex: isFlipping ? 3 : 2,
                transformOrigin: 'bottom',
                transition: isFlipping ? 'transform 0.4s ease-in' : 'none',
                transform: isFlipping ? 'rotateX(-90deg)' : 'rotateX(0deg)',
                background: `linear-gradient(180deg, ${color} 0%, ${color}dd 100%)`
            }}>
                <span style={{ transform: 'translateY(50%)' }}>{displayDigit}</span>
            </div>
            <div style={{
                ...bottomStyle,
                zIndex: isFlipping ? 4 : 2,
                transformOrigin: 'top',
                transition: isFlipping ? 'transform 0.4s ease-out 0.4s' : 'none',
                transform: isFlipping ? 'rotateX(0deg)' : 'rotateX(90deg)',
                background: `linear-gradient(180deg, ${color} 0%, ${color}dd 100%)`
            }}>
                <span style={{ transform: 'translateY(-50%)' }}>{nextDigit}</span>
            </div>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.3)', zIndex: 10 }} />
        </div>
    )
}

const TimeUnit = ({ value, label, color }: { value: number, label: string, color: string }) => {
    const str = String(value).padStart(2, '0')
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
                <FlipDigit digit={str[0]} color={color} />
                <FlipDigit digit={str[1]} color={color} />
            </div>
            <div style={{ fontSize: '6px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{label}</div>
        </div>
    )
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
        intervalRef.current = setInterval(() => setTimeLeft(calcTimeLeft()), 1000)
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [config?.startDate])

    if (!config) return null

    return (
        <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-30px',
            zIndex: 15,
            transformOrigin: 'top center',
            animation: 'hangingSwing 6s ease-in-out infinite alternate',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 15px' }}>
                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
            </div>

            <div style={{
                background: '#2b3945',
                borderRadius: '12px',
                padding: '10px 12px 8px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                textAlign: 'center',
            }}>
                <div style={{ position: 'relative', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', left: 0, top: '50%', width: '10px', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
                    <div style={{ position: 'absolute', right: 0, top: '50%', width: '10px', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: '7px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', background: '#2b3945', padding: '0 6px', zIndex: 1 }}>
                        Time Remaining
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '6px' }}>
                    <TimeUnit value={timeLeft.days} label="Days" color="#f59e0b" />
                    <div style={{ marginTop: '5px', fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.15)' }}>:</div>
                    <TimeUnit value={timeLeft.hours} label="Hours" color="#84cc16" />
                    <div style={{ marginTop: '5px', fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.15)' }}>:</div>
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
