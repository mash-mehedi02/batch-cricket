import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'

// 4 pose images — two for each player
import batterReadySrc from '@/assets/hero-assets/batter-ready.png'
import batterSixSrc from '@/assets/hero-assets/batter-six.png'
import bowlerRunSrc from '@/assets/hero-assets/bowler-action.png'
import bowlerReleaseSrc from '@/assets/hero-assets/bowler-release.png'

type Phase = 'bowler-run' | 'delivery' | 'hit-six' | 'celebration' | 'reset'

const PHASE_DURATIONS: Record<Phase, number> = {
    'bowler-run': 2000,
    'delivery': 1100,
    'hit-six': 1500,
    'celebration': 1800,
    'reset': 500,
}

const PHASE_ORDER: Phase[] = ['bowler-run', 'delivery', 'hit-six', 'celebration', 'reset']

// ====== Canvas hook: completely clean black background ======
function useTransparentImage(src: string, threshold = 40) {
    const [dataUrl, setDataUrl] = useState<string | null>(null)

    useEffect(() => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            // Improved background removal algorithm
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2]
                const maxBrightness = Math.max(r, g, b) // Best metric for neon colors

                if (maxBrightness <= threshold) {
                    // Hard cut off for background colors
                    data[i + 3] = 0
                } else if (maxBrightness < threshold + 40) {
                    // Soft fade for the glow edges (quadratic easing for smooth blend)
                    const ratio = (maxBrightness - threshold) / 40
                    data[i + 3] = data[i + 3] * Math.pow(ratio, 1.5)
                }
            }

            ctx.putImageData(imageData, 0, 0)
            setDataUrl(canvas.toDataURL('image/png'))
        }
        img.src = src
    }, [src, threshold])

    return dataUrl
}

// ====== BATTER with pose crossfade ======
const BatterAnimated = ({ phase }: { phase: Phase }) => {
    const readyImg = useTransparentImage(batterReadySrc)
    const sixImg = useTransparentImage(batterSixSrc)

    const show = phase !== 'reset'
    const isHitting = phase === 'hit-six' || phase === 'celebration'

    return (
        <motion.div
            className="absolute z-20"
            style={{ left: '8%', bottom: '0%', width: '55%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: show ? 1 : 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Ready stance — visible during bowler-run and delivery */}
            <AnimatePresence>
                {!isHitting && readyImg && (
                    <motion.img
                        key="batter-ready"
                        src={readyImg}
                        alt="Batter ready stance"
                        className="w-full h-auto object-contain absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                            filter: 'brightness(1) drop-shadow(0 0 20px rgba(45,212,191,0.3))',
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    />
                )}
            </AnimatePresence>

            {/* Kneeling six shot — visible during hit-six and celebration */}
            <AnimatePresence>
                {isHitting && sixImg && (
                    <motion.img
                        key="batter-six"
                        src={sixImg}
                        alt="Batter hitting six"
                        className="w-full h-auto object-contain absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                            filter: 'brightness(1.3) drop-shadow(0 0 30px rgba(45,212,191,0.6))',
                            WebkitMaskImage: 'radial-gradient(circle at 85% 15%, transparent 0%, transparent 8%, black 15%)',
                            maskImage: 'radial-gradient(circle at 85% 15%, transparent 0%, transparent 8%, black 15%)'
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    />
                )}
            </AnimatePresence>

            {/* Invisible spacer to maintain container size */}
            <img
                src={sixImg || readyImg || ''}
                alt=""
                className="w-full h-auto object-contain invisible"
            />
        </motion.div>
    )
}

// ====== BOWLER with pose crossfade ======
const BowlerAnimated = ({ phase }: { phase: Phase }) => {
    const runImg = useTransparentImage(bowlerRunSrc)
    const releaseImg = useTransparentImage(bowlerReleaseSrc)

    const show = phase !== 'reset'
    const isRunning = phase === 'bowler-run'
    const hasDelivered = phase === 'delivery' || phase === 'hit-six' || phase === 'celebration'

    return (
        <motion.div
            className="absolute z-15"
            style={{ right: '5%', bottom: '5%', width: '32%' }}
            initial={{ x: 60, opacity: 0 }}
            animate={{
                x: isRunning ? [60, 0] : 0,
                opacity: show ? 0.9 : 0,
            }}
            transition={{
                x: { duration: isRunning ? 2 : 0.1, ease: 'easeOut' },
                opacity: { duration: 0.3 },
            }}
        >
            {/* Running pose — visible during bowler-run */}
            <AnimatePresence>
                {isRunning && runImg && (
                    <motion.img
                        key="bowler-run"
                        src={runImg}
                        alt="Bowler running"
                        className="w-full h-auto object-contain absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                            filter: 'brightness(1) drop-shadow(0 0 15px rgba(45,212,191,0.3))',
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    />
                )}
            </AnimatePresence>

            {/* Delivery stride — visible after delivery */}
            <AnimatePresence>
                {hasDelivered && releaseImg && (
                    <motion.img
                        key="bowler-release"
                        src={releaseImg}
                        alt="Bowler delivery"
                        className="w-full h-auto object-contain absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                            filter: 'brightness(1.2) drop-shadow(0 0 20px rgba(45,212,191,0.4))',
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    />
                )}
            </AnimatePresence>

            {/* Invisible spacer */}
            <img
                src={runImg || releaseImg || ''}
                alt=""
                className="w-full h-auto object-contain invisible"
            />
        </motion.div>
    )
}

// ====== CRICKET BALL ======
const CricketBall = ({ phase }: { phase: Phase }) => {
    if (phase !== 'delivery' && phase !== 'hit-six' && phase !== 'celebration') return null

    return (
        <>
            {/* The ball */}
            <motion.div
                className="absolute w-4 h-4 sm:w-5 sm:h-5 rounded-full z-30"
                style={{
                    backgroundColor: '#d4a82d',
                    boxShadow: '0 0 16px 6px rgba(212,168,45,0.7), 0 0 40px 10px rgba(212,168,45,0.3)',
                }}
                animate={{
                    // Delivery: bowler → batter
                    // Hit-six: batter → flies off screen top-left
                    // Celebration: already off screen
                    left: phase === 'delivery'
                        ? ['72%', '55%', '42%']
                        : phase === 'hit-six'
                            ? ['42%', '15%', '-20%']
                            : '-20%',
                    top: phase === 'delivery'
                        ? ['32%', '48%', '58%']
                        : phase === 'hit-six'
                            ? ['58%', '10%', '-25%']
                            : '-25%',
                    scale: phase === 'hit-six' ? [1, 1.3, 0.4] : 1,
                    opacity: phase === 'celebration' ? 0 : 1,
                }}
                transition={{
                    duration: phase === 'delivery' ? 1 : phase === 'hit-six' ? 1.1 : 0.1,
                    ease: phase === 'hit-six' ? [0.2, 0.8, 0.2, 1] : 'easeIn',
                }}
            />

            {/* Golden trail arc for six */}
            {phase === 'hit-six' && (
                <motion.div
                    className="absolute z-25 pointer-events-none"
                    style={{ left: '0%', top: '-10%', width: '50%', height: '75%' }}
                >
                    <svg viewBox="0 0 200 200" className="w-full h-full" style={{ overflow: 'visible' }}>
                        <defs>
                            <filter id="trailGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="3" result="b" />
                                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>
                        <motion.path
                            d="M190,195 Q130,90 15,5"
                            stroke="#d4a82d"
                            strokeWidth="3"
                            fill="none"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: [0, 0.9, 0.4] }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            filter="url(#trailGlow)"
                        />
                        {/* Sparkles along trail */}
                        {[...Array(8)].map((_, i) => {
                            const t = i / 7
                            return (
                                <motion.circle
                                    key={i}
                                    cx={190 - 175 * t}
                                    cy={195 - 190 * t}
                                    r={1.5 + Math.random() * 2}
                                    fill={i % 2 === 0 ? '#d4a82d' : '#fff'}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 1, 0], scale: [0, 2, 0] }}
                                    transition={{ duration: 0.5, delay: 0.1 * i }}
                                    filter="url(#trailGlow)"
                                />
                            )
                        })}
                    </svg>
                </motion.div>
            )}
        </>
    )
}

// ====== CELEBRATION PARTICLES ======
const CelebrationParticles = ({ phase }: { phase: Phase }) => {
    const particles = useMemo(() =>
        Array.from({ length: 24 }, (_, i) => ({
            angle: (i * 360) / 24 + Math.random() * 15,
            distance: 50 + Math.random() * 140,
            size: 3 + Math.random() * 5,
            delay: Math.random() * 0.5,
            type: i % 4,
        })), []
    )

    if (phase !== 'celebration') return null

    return (
        <div className="absolute inset-0 z-40 pointer-events-none">
            {particles.map((p, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        left: '35%', top: '45%',
                        width: p.size, height: p.size,
                        backgroundColor: p.type === 0 ? '#d4a82d' : p.type === 2 ? '#fff' : '#2dd4bf',
                        boxShadow: p.type === 0 ? '0 0 8px #d4a82d' : p.type === 2 ? '0 0 6px #fff' : '0 0 8px #2dd4bf',
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                        x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
                        y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
                        opacity: [0, 1, 0],
                        scale: [0, 1.5, 0],
                    }}
                    transition={{ duration: 1.3, delay: p.delay, ease: 'easeOut' }}
                />
            ))}
        </div>
    )
}

// ====== SIX TEXT ======
const SixText = ({ phase }: { phase: Phase }) => {
    if (phase !== 'celebration') return null

    return (
        <motion.div
            className="absolute z-50 pointer-events-none"
            style={{ left: '14%', top: '10%' }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.3, 1.1, 0.8] }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
        >
            <span
                className="text-5xl sm:text-6xl font-black italic tracking-tight"
                style={{
                    color: '#d4a82d',
                    textShadow: '0 0 20px rgba(212,168,45,0.8), 0 0 60px rgba(212,168,45,0.4), 0 0 100px rgba(212,168,45,0.2)',
                    WebkitTextStroke: '1px rgba(255,255,255,0.15)',
                }}
            >
                SIX!
            </span>
        </motion.div>
    )
}

// ====== AMBIENT PARTICLES ======
const AmbientParticles = () => {
    const particles = useMemo(() =>
        Array.from({ length: 10 }, (_, i) => ({
            left: 10 + Math.random() * 80,
            top: 15 + Math.random() * 70,
            size: 2 + Math.random() * 2.5,
            duration: 5 + Math.random() * 4,
            delay: Math.random() * 5,
            isGold: Math.random() > 0.7,
        })), []
    )

    return (
        <>
            {particles.map((p, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full pointer-events-none z-10"
                    style={{
                        left: `${p.left}%`, top: `${p.top}%`,
                        width: p.size, height: p.size,
                        backgroundColor: p.isGold ? '#d4a82d' : i % 3 === 0 ? '#fff' : '#2dd4bf',
                        boxShadow: `0 0 6px ${p.isGold ? '#d4a82d' : '#2dd4bf'}`,
                    }}
                    animate={{ opacity: [0, 0.5, 0], y: [-5, -30] }}
                    transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                />
            ))}
        </>
    )
}

// ====== MAIN ======
const HeroCricketAnimation = () => {
    const [phase, setPhase] = useState<Phase>('bowler-run')

    useEffect(() => {
        let idx = 0
        let t: ReturnType<typeof setTimeout>
        const next = () => {
            idx = (idx + 1) % PHASE_ORDER.length
            setPhase(PHASE_ORDER[idx])
            t = setTimeout(next, PHASE_DURATIONS[PHASE_ORDER[idx]])
        }
        t = setTimeout(next, PHASE_DURATIONS[PHASE_ORDER[0]])
        return () => clearTimeout(t)
    }, [])

    return (
        <div className="relative w-full max-w-[440px] sm:max-w-lg md:max-w-xl mx-auto aspect-[16/10] overflow-visible">

            <AmbientParticles />
            <BatterAnimated phase={phase} />
            <BowlerAnimated phase={phase} />
            <CricketBall phase={phase} />
            <CelebrationParticles phase={phase} />
            <SixText phase={phase} />

            {/* Subtle ground line */}
            <div
                className="absolute bottom-[1%] left-[10%] right-[10%] h-[1px] z-5"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.15), rgba(45,212,191,0.2), rgba(45,212,191,0.15), transparent)',
                }}
            />
        </div>
    )
}

export default HeroCricketAnimation
