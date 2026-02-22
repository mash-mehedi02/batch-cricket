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
            width: '28px',
            height: '40px',
            background: `linear-gradient(180deg, ${color} 0%, ${color}dd 100%)`,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: '900',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            {/* Gloss effect */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: 'rgba(255,255,255,0.08)',
                zIndex: 1
            }} />
            {/* Center Split Line */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                background: 'rgba(0,0,0,0.3)',
                zIndex: 2
            }} />
            <span style={{ position: 'relative', zIndex: 3, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{value}</span>
        </div>
    )

    const TimeUnit = ({ value, label, color }: { value: number, label: string, color: string }) => {
        const str = String(value).padStart(2, '0')
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                    <DigitCard value={str[0]} color={color} />
                    <DigitCard value={str[1]} color={color} />
                </div>
                <div style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>{label}</div>
            </div>
        )
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
                padding: '16px',
                background: 'rgba(2, 6, 23, 0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                opacity: closing ? 0 : 1,
                transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    background: 'linear-gradient(165deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: '28px',
                    overflow: 'hidden',
                    boxShadow: '0 0 80px rgba(0,0,0,0.6), 0 20px 40px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    transform: closing ? 'scale(0.9) translateY(20px)' : 'scale(1) translateY(0)',
                    opacity: closing ? 0 : 1,
                    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    animation: 'popupSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    position: 'relative'
                }}
            >
                {/* Decorative Elements */}
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'rgba(20,184,166,0.1)', borderRadius: '50%', filter: 'blur(40px)' }} />
                <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '150px', height: '150px', background: 'rgba(59,130,246,0.1)', borderRadius: '50%', filter: 'blur(40px)' }} />

                <div style={{ padding: '32px 20px 24px', position: 'relative', textAlign: 'center', zIndex: 10 }}>

                    {/* School Branding */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                        <img src={schoolConfig.logo} alt="School" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '8px', fontWeight: '900', color: '#14b8a6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Official Tournament</div>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.9)' }}>{schoolConfig.name}</div>
                        </div>
                    </div>

                    {/* Tournament Logo & Name */}
                    {config.tournamentLogo && (
                        <div style={{
                            width: '74px',
                            height: '74px',
                            borderRadius: '20px',
                            margin: '0 auto 16px',
                            border: '1.5px solid rgba(20,184,166,0.3)',
                            padding: '4px',
                            background: 'rgba(255,255,255,0.05)',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                        }}>
                            <img src={config.tournamentLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '15px' }} />
                        </div>
                    )}
                    <h2 style={{ fontSize: '20px', fontWeight: '950', color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: '1.2' }}>{config.tournamentName}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#14b8a6', fontSize: '12px', fontWeight: '800', marginBottom: '28px' }}>
                        <Calendar size={13} strokeWidth={2.5} /> {formatDate(config.startDate)}
                    </div>

                    {/* TIME REMAINING SECTION */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.4)',
                        padding: '20px 12px',
                        borderRadius: '24px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ position: 'relative', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ position: 'absolute', left: '10%', right: '10%', top: '50%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />
                            <span style={{
                                fontSize: '13px',
                                fontWeight: '900',
                                color: 'rgba(255,255,255,0.8)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.2em',
                                background: '#1c2635',
                                padding: '0 12px',
                                zIndex: 1
                            }}>
                                Time Remaining
                            </span>
                        </div>

                        {/* Countdown Grid - Optimized Gaps */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '6px' }}>
                            <TimeUnit value={timeLeft.days} label="Days" color="#f59e0b" />
                            <div style={{ marginTop: '10px', fontSize: '18px', fontWeight: '900', color: 'rgba(255,255,255,0.2)' }}>:</div>
                            <TimeUnit value={timeLeft.hours} label="Hrs" color="#84cc16" />
                            <div style={{ marginTop: '10px', fontSize: '18px', fontWeight: '900', color: 'rgba(255,255,255,0.2)' }}>:</div>
                            <TimeUnit value={timeLeft.minutes} label="Mins" color="#ef4444" />
                            <div style={{ marginTop: '10px', fontSize: '18px', fontWeight: '900', color: 'rgba(255,255,255,0.2)' }}>:</div>
                            <TimeUnit value={timeLeft.seconds} label="Secs" color="#a855f7" />
                        </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            onClick={handleClose}
                            style={{
                                width: '100%',
                                padding: '15px',
                                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                                border: 'none',
                                borderRadius: '14px',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: '900',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                boxShadow: '0 8px 20px rgba(20,184,166,0.3)',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                        >
                            Enter Platform
                        </button>
                        <button
                            onClick={handleClose}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '11px', cursor: 'pointer', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px' }}
                        >
                            Skip for now
                        </button>
                    </div>
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
