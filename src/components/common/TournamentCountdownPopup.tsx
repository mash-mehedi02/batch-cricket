/**
 * Tournament Countdown Popup
 * Premium countdown overlay shown on app entry
 * Admin-controlled via Firestore settings/countdownPopup
 * REAL FLIP-CLOCK ANIMATION Logic (Improved Visibility)
 */

import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Calendar } from 'lucide-react'
import schoolConfig from '@/config/school'

interface CountdownPopupConfig {
    enabled: boolean
    tournamentName: string
    tournamentLogo: string
    startDate: string
}

// Flip Digit Component
const FlipDigit = ({ digit, color }: { digit: string, color: string }) => {
    const [displayDigit, setDisplayDigit] = useState(digit)
    const [nextDigit, setNextDigit] = useState(digit)
    const [isFlipping, setIsFlipping] = useState(false)

    useEffect(() => {
        if (digit !== nextDigit) {
            setNextDigit(digit)
            setIsFlipping(true)

            // After animation ends, sync the display digit
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
        fontSize: '24px',
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
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        borderBottom: '1px solid rgba(0,0,0,0.15)',
    }

    const bottomStyle: React.CSSProperties = {
        ...commonStyle,
        bottom: 0,
        alignItems: 'flex-start',
        borderBottomLeftRadius: '6px',
        borderBottomRightRadius: '6px',
    }

    return (
        <div style={{
            position: 'relative',
            width: '32px',
            height: '46px',
            perspective: '300px',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.2)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
            {/* 1. UPPER BACK (The NEW digit that will be revealed) */}
            <div style={{ ...topStyle, zIndex: 1 }}>
                <span style={{ transform: 'translateY(50%)' }}>{nextDigit}</span>
            </div>

            {/* 2. LOWER BACK (The OLD digit currently visible) */}
            <div style={{ ...bottomStyle, zIndex: 1 }}>
                <span style={{ transform: 'translateY(-50%)' }}>{displayDigit}</span>
            </div>

            {/* 3. UPPER FLAP (The OLD digit that moves/flips down) */}
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

            {/* 4. LOWER FLAP (The NEW digit that appears from behind) */}
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

            {/* Aesthetic Split Line Overlay */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1.5px',
                background: 'rgba(0,0,0,0.4)',
                zIndex: 10
            }} />

            {/* Glossy Overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                pointerEvents: 'none',
                zIndex: 11,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)'
            }} />
        </div>
    )
}

const TimeUnit = ({ value, label, color }: { value: number, label: string, color: string }) => {
    const str = String(value).padStart(2, '0')
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
                <FlipDigit digit={str[0]} color={color} />
                <FlipDigit digit={str[1]} color={color} />
            </div>
            <div style={{
                fontSize: '10px',
                fontWeight: '900',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
            }}>{label}</div>
        </div>
    )
}

export default function TournamentCountdownPopup() {
    const [config, setConfig] = useState<CountdownPopupConfig | null>(null)
    const [show, setShow] = useState(false)
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
    const [closing, setClosing] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        const docRef = doc(db, 'settings', 'countdownPopup')
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as CountdownPopupConfig
                if (!data.enabled) {
                    setShow(false)
                    setConfig(null)
                    return
                }
                const dismissed = sessionStorage.getItem('countdown_dismissed')
                if (dismissed) {
                    setConfig(data)
                    return
                }
                if (data.tournamentName && data.startDate) {
                    setConfig(data)
                    setShow(true)
                }
            }
        })
        return () => unsubscribe()
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

    const handleClose = () => {
        setClosing(true)
        sessionStorage.setItem('countdown_dismissed', 'true')
        setTimeout(() => {
            setShow(false)
            setClosing(false)
        }, 400)
    }

    if (!show || !config) return null

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00')
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    return (
        <div
            onClick={handleClose}
            className="hide-in-screenshot"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                background: 'rgba(2, 6, 23, 0.8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                opacity: closing ? 0 : 1,
                transition: 'opacity 0.4s ease',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    background: 'linear-gradient(165deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: '32px',
                    overflow: 'hidden',
                    boxShadow: '0 0 100px rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    transform: closing ? 'scale(0.9) translateY(20px)' : 'scale(1) translateY(0)',
                    opacity: closing ? 0 : 1,
                    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    animation: 'popupSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    position: 'relative'
                }}
            >
                <div style={{ padding: '36px 24px 28px', position: 'relative', textAlign: 'center', zIndex: 10 }}>

                    {/* Brand */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
                        <img src={schoolConfig.logo} alt="School" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '9px', fontWeight: '900', color: '#14b8a6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Official Tournament</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'rgba(255,255,255,0.9)' }}>{schoolConfig.name}</div>
                        </div>
                    </div>

                    {/* Logo */}
                    {config.tournamentLogo && (
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '24px', margin: '0 auto 16px',
                            border: '1.5px solid rgba(20,184,166,0.3)', padding: '5px', background: 'rgba(255,255,255,0.05)',
                        }}>
                            <img src={config.tournamentLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '18px' }} />
                        </div>
                    )}

                    <h2 style={{ fontSize: '22px', fontWeight: '950', color: '#fff', marginBottom: '8px', letterSpacing: '-0.02em' }}>{config.tournamentName}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#14b8a6', fontSize: '13px', fontWeight: '800', marginBottom: '32px' }}>
                        <Calendar size={14} strokeWidth={2.5} /> {formatDate(config.startDate)}
                    </div>

                    {/* FLIP SECTION */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '28px 10px',
                        borderRadius: '24px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.3)',
                        width: '100%',
                    }}>
                        <div style={{ position: 'relative', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ position: 'absolute', left: '15%', right: '15%', top: '50%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />
                            <span style={{ fontSize: '13px', fontWeight: '900', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.15em', background: '#1e293b', padding: '0 12px', zIndex: 1 }}>
                                Time Remaining
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '5px' }}>
                            <TimeUnit value={timeLeft.days} label="Days" color="#f59e0b" />
                            <div style={{ marginTop: '12px', fontSize: '16px', fontWeight: '900', color: 'rgba(255,255,255,0.15)' }}>:</div>
                            <TimeUnit value={timeLeft.hours} label="Hours" color="#84cc16" />
                            <div style={{ marginTop: '12px', fontSize: '16px', fontWeight: '900', color: 'rgba(255,255,255,0.15)' }}>:</div>
                            <TimeUnit value={timeLeft.minutes} label="Mins" color="#ef4444" />
                            <div style={{ marginTop: '12px', fontSize: '16px', fontWeight: '900', color: 'rgba(255,255,255,0.15)' }}>:</div>
                            <TimeUnit value={timeLeft.seconds} label="Secs" color="#a855f7" />
                        </div>
                    </div>

                    <button onClick={handleClose} style={{ width: '100%', marginTop: '32px', padding: '16px', background: 'linear-gradient(135deg, #14b8a6, #0d9488)', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '14px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.12em', boxShadow: '0 8px 25px rgba(20,184,166,0.3)', transition: '0.3s' }}>
                        Enter Platform
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes popupSlideIn {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    )
}
