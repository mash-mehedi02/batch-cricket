/**
 * Tournament Countdown Popup
 * Premium countdown overlay shown on app entry
 * Admin-controlled via Firestore settings/countdownPopup
 * Exact "Time Remaining" flip-clock design matching user reference
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
    startDate: string // ISO date string e.g. "2026-03-19"
    subtitle?: string
}

export default function TournamentCountdownPopup() {
    const [config, setConfig] = useState<CountdownPopupConfig | null>(null)
    const [show, setShow] = useState(false)
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
    const [closing, setClosing] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Subscribe to config in real-time
    useEffect(() => {
        const docRef = doc(db, 'settings', 'countdownPopup')
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as CountdownPopupConfig

                // If it's disabled globally, hide it immediately
                if (!data.enabled) {
                    setShow(false)
                    setConfig(null)
                    return
                }

                // If enabled, check session dismissal
                const dismissed = sessionStorage.getItem('countdown_dismissed')
                if (dismissed) {
                    setConfig(data) // Keep data updated just in case, but don't show
                    return
                }

                if (data.tournamentName && data.startDate) {
                    setConfig(data)
                    setShow(true)
                }
            }
        }, (err) => {
            console.warn('[CountdownPopup] Subscription error:', err)
        })

        return () => unsubscribe()
    }, [])

    // Countdown timer
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

    const DigitCard = ({ value, color }: { value: string, color: string }) => (
        <div style={{
            position: 'relative',
            width: '38px',
            height: '52px',
            background: color,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            overflow: 'hidden'
        }}>
            {/* Center Split Line */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                background: 'rgba(0,0,0,0.2)',
                zIndex: 2
            }} />
            {/* Split dots on sides */}
            <div style={{ position: 'absolute', left: '-2px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)', zIndex: 3 }} />
            <div style={{ position: 'absolute', right: '-2px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)', zIndex: 3 }} />
            {value}
        </div>
    )

    const TimeUnit = ({ value, label, color }: { value: number, label: string, color: string }) => {
        const str = String(value).padStart(2, '0')
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <DigitCard value={str[0]} color={color} />
                    <DigitCard value={str[1]} color={color} />
                </div>
                <div style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
            </div>
        )
    }

    return (
        <div
            onClick={handleClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                opacity: closing ? 0 : 1,
                transition: 'opacity 0.4s ease',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '440px',
                    background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                    borderRadius: '32px',
                    overflow: 'hidden',
                    boxShadow: '0 0 100px rgba(0,0,0,0.5), 0 25px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    transform: closing ? 'scale(0.9) translateY(20px)' : 'scale(1) translateY(0)',
                    opacity: closing ? 0 : 1,
                    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    animation: 'popupSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            >
                {/* Content */}
                <div style={{ padding: '40px 24px 32px', position: 'relative', textAlign: 'center' }}>

                    {/* Header with School Branding */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
                        <img src={schoolConfig.logo} alt="School" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '9px', fontWeight: 800, color: '#14b8a6', textTransform: 'uppercase' }}>Official Tournament</div>
                            <div style={{ fontSize: '13px', fontWeight: 900, color: '#fff' }}>{schoolConfig.name}</div>
                        </div>
                    </div>

                    {/* Tournament Logo & Name */}
                    {config.tournamentLogo && (
                        <div style={{ width: '80px', height: '80px', borderRadius: '24px', margin: '0 auto 16px', border: '2px solid rgba(20,184,166,0.3)', padding: '4px', background: 'rgba(255,255,255,0.03)' }}>
                            <img src={config.tournamentLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '18px' }} />
                        </div>
                    )}
                    <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', marginBottom: '4px', letterSpacing: '-0.01em' }}>{config.tournamentName}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#14b8a6', fontSize: '13px', fontWeight: 700, marginBottom: '32px' }}>
                        <Calendar size={14} /> {formatDate(config.startDate)}
                    </div>

                    {/* TIME REMAINING SECTION - Exact Reference Design */}
                    <div style={{
                        background: '#2b3945',
                        padding: '24px 16px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.2)'
                    }}>
                        {/* Title with Lines */}
                        <div style={{ position: 'relative', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ position: 'absolute', left: 0, top: '50%', width: '25%', borderBottom: '1px dashed rgba(255,255,255,0.15)' }} />
                            <div style={{ position: 'absolute', right: 0, top: '50%', width: '25%', borderBottom: '1px dashed rgba(255,255,255,0.15)' }} />
                            <span style={{
                                fontSize: '16px',
                                fontWeight: 800,
                                color: '#f8fafc',
                                textTransform: 'uppercase',
                                letterSpacing: '0.15em',
                                background: '#2b3945',
                                padding: '0 15px',
                                zIndex: 1
                            }}>
                                Time Remaining
                            </span>
                        </div>

                        {/* Countdown Grid */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '8px' }}>
                            <TimeUnit value={timeLeft.days} label="Days" color="#f59e0b" />
                            <div style={{ marginTop: '16px', fontSize: '24px', fontWeight: 900, color: 'rgba(255,255,255,0.3)' }}>:</div>
                            <TimeUnit value={timeLeft.hours} label="Hours" color="#84cc16" />
                            <div style={{ marginTop: '16px', fontSize: '24px', fontWeight: 900, color: 'rgba(255,255,255,0.3)' }}>:</div>
                            <TimeUnit value={timeLeft.minutes} label="Minutes" color="#ef4444" />
                            <div style={{ marginTop: '16px', fontSize: '24px', fontWeight: 900, color: 'rgba(255,255,255,0.3)' }}>:</div>
                            <TimeUnit value={timeLeft.seconds} label="Seconds" color="#a855f7" />
                        </div>
                    </div>

                    {/* Let's Go Button */}
                    <button
                        onClick={handleClose}
                        style={{
                            width: '100%',
                            marginTop: '32px',
                            padding: '16px',
                            background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                            border: 'none',
                            borderRadius: '16px',
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 900,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            boxShadow: '0 10px 25px rgba(20,184,166,0.3)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(20,184,166,0.4)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(20,184,166,0.3)'; }}
                    >
                        Enter Platform
                    </button>

                    {/* Small Close Link */}
                    <button
                        onClick={handleClose}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '10px', marginTop: '16px', cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    >
                        Skip for now
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes popupSlideIn {
                    from { opacity: 0; transform: scale(0.9) translateY(40px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    )
}
