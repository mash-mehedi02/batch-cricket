/**
 * HeroCricketAnimation — GSAP-powered stump animation
 * A cinematic hero stump with cricket elements rising from below.
 * Zero lag, GPU-accelerated via GSAP.
 */

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import heroStump from '@/assets/hero-assets/hero-stump.png'

// ====== SVG Cricket Icons (inline for zero loading) ======
const BatIcon = () => (
    <svg viewBox="0 0 48 100" fill="none" className="w-full h-full">
        <rect x="20" y="0" width="8" height="45" rx="2" fill="url(#batHandle)" />
        <rect x="12" y="42" width="24" height="52" rx="5" fill="url(#batBlade)" stroke="rgba(45,212,191,0.3)" strokeWidth="0.5" />
        <line x1="24" y1="50" x2="24" y2="88" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <defs>
            <linearGradient id="batHandle" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B6914" />
                <stop offset="100%" stopColor="#A0792A" />
            </linearGradient>
            <linearGradient id="batBlade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A84C" />
                <stop offset="50%" stopColor="#E8D08A" />
                <stop offset="100%" stopColor="#C9A84C" />
            </linearGradient>
        </defs>
    </svg>
)

const BallIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
        <circle cx="20" cy="20" r="18" fill="url(#ballGrad)" />
        <path d="M8,15 Q20,22 32,15" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.5" />
        <path d="M8,25 Q20,18 32,25" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.5" />
        <circle cx="20" cy="20" r="18" stroke="rgba(45,212,191,0.2)" strokeWidth="0.5" fill="none" />
        <defs>
            <radialGradient id="ballGrad" cx="35%" cy="35%">
                <stop offset="0%" stopColor="#E84040" />
                <stop offset="80%" stopColor="#B22222" />
                <stop offset="100%" stopColor="#8B1A1A" />
            </radialGradient>
        </defs>
    </svg>
)

const TrophyIcon = () => (
    <svg viewBox="0 0 50 60" fill="none" className="w-full h-full">
        <path d="M15,8 L15,28 C15,38 25,42 25,42 C25,42 35,38 35,28 L35,8 Z" fill="url(#trophyGrad)" stroke="rgba(212,168,45,0.4)" strokeWidth="0.5" />
        <path d="M15,12 C10,12 5,16 6,22 C7,27 12,28 15,26" fill="url(#trophyGrad)" opacity="0.7" />
        <path d="M35,12 C40,12 45,16 44,22 C43,27 38,28 35,26" fill="url(#trophyGrad)" opacity="0.7" />
        <rect x="20" y="42" width="10" height="6" rx="1" fill="#C9A84C" />
        <rect x="16" y="48" width="18" height="5" rx="2" fill="#D4A82D" stroke="rgba(255,255,255,0.15)" strokeWidth="0.3" />
        <defs>
            <linearGradient id="trophyGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F0D76E" />
                <stop offset="50%" stopColor="#D4A82D" />
                <stop offset="100%" stopColor="#A0792A" />
            </linearGradient>
        </defs>
    </svg>
)

const HelmetIcon = () => (
    <svg viewBox="0 0 50 45" fill="none" className="w-full h-full">
        <ellipse cx="25" cy="22" rx="22" ry="18" fill="url(#helmetGrad)" />
        <path d="M8,26 Q25,32 42,26 Q42,40 25,42 Q8,40 8,26Z" fill="#1a365d" stroke="rgba(45,212,191,0.2)" strokeWidth="0.5" />
        <rect x="12" y="24" width="3" height="12" rx="1" fill="#555" opacity="0.6" />
        <rect x="18" y="23" width="3" height="14" rx="1" fill="#555" opacity="0.6" />
        <rect x="24" y="22" width="3" height="15" rx="1" fill="#555" opacity="0.6" />
        <rect x="30" y="23" width="3" height="14" rx="1" fill="#555" opacity="0.6" />
        <rect x="36" y="24" width="3" height="12" rx="1" fill="#555" opacity="0.6" />
        <defs>
            <linearGradient id="helmetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1E40AF" />
            </linearGradient>
        </defs>
    </svg>
)

const StarIcon = () => (
    <svg viewBox="0 0 30 30" fill="none" className="w-full h-full">
        <path d="M15,2 L18,11 L28,11 L20,17 L23,27 L15,21 L7,27 L10,17 L2,11 L12,11 Z" fill="#D4A82D" opacity="0.8" />
    </svg>
)

// ====== MAIN COMPONENT ======
const HeroCricketAnimation = () => {
    const containerRef = useRef<HTMLDivElement>(null)
    const stumpRef = useRef<HTMLImageElement>(null)
    const glowRef = useRef<HTMLDivElement>(null)
    const obstacleRefs = useRef<(HTMLDivElement | null)[]>([])
    const particleRefs = useRef<(HTMLDivElement | null)[]>([])

    useEffect(() => {
        if (!containerRef.current) return

        const ctx = gsap.context(() => {
            // 1. Stump entrance — scale up with spring
            gsap.fromTo(stumpRef.current,
                { y: 40, opacity: 0, scale: 0.85 },
                { y: 0, opacity: 1, scale: 1, duration: 1, ease: 'back.out(1.4)', delay: 0.2 }
            )

            // 2. Glow pulse — infinite subtle pulse
            gsap.fromTo(glowRef.current,
                { opacity: 0.3, scale: 0.9 },
                { opacity: 0.6, scale: 1.1, duration: 2.5, ease: 'sine.inOut', repeat: -1, yoyo: true }
            )

            // 3. Obstacles rise up from below — staggered
            const obstacles = obstacleRefs.current.filter(Boolean) as HTMLDivElement[]
            obstacles.forEach((el, i) => {
                // Initial position: fully below
                gsap.set(el, { y: 80, opacity: 0, scale: 0.7 })

                // Rise up with stagger
                gsap.to(el, {
                    y: 0, opacity: 1, scale: 1,
                    duration: 0.8,
                    ease: 'back.out(1.6)',
                    delay: 0.6 + i * 0.15,
                })

                // Continuous gentle float after entrance
                gsap.to(el, {
                    y: -6 - Math.random() * 6,
                    duration: 2.5 + Math.random() * 1.5,
                    ease: 'sine.inOut',
                    repeat: -1,
                    yoyo: true,
                    delay: 1.5 + i * 0.15,
                })
            })

            // 4. Floating ambient particles
            const particles = particleRefs.current.filter(Boolean) as HTMLDivElement[]
            particles.forEach((el, i) => {
                gsap.set(el, { opacity: 0, y: 20 })
                gsap.to(el, {
                    opacity: [0, 0.6, 0],
                    y: -40 - Math.random() * 30,
                    x: (Math.random() - 0.5) * 30,
                    duration: 4 + Math.random() * 3,
                    ease: 'sine.inOut',
                    repeat: -1,
                    delay: Math.random() * 4,
                })
            })

        }, containerRef)

        return () => ctx.revert()
    }, [])

    // Obstacle configuration — positioned around the stump
    const obstacles = [
        { icon: <BatIcon />, size: 'w-8 h-16 sm:w-10 sm:h-20', pos: 'left-[5%] bottom-[8%]', rotate: '-15deg' },
        { icon: <BallIcon />, size: 'w-8 h-8 sm:w-10 sm:h-10', pos: 'right-[8%] bottom-[12%]', rotate: '0deg' },
        { icon: <TrophyIcon />, size: 'w-10 h-12 sm:w-12 sm:h-14', pos: 'left-[18%] bottom-[0%]', rotate: '5deg' },
        { icon: <HelmetIcon />, size: 'w-9 h-8 sm:w-11 sm:h-10', pos: 'right-[18%] bottom-[2%]', rotate: '-8deg' },
        { icon: <StarIcon />, size: 'w-5 h-5 sm:w-6 sm:h-6', pos: 'left-[35%] bottom-[28%]', rotate: '10deg' },
        { icon: <StarIcon />, size: 'w-4 h-4 sm:w-5 sm:h-5', pos: 'right-[32%] bottom-[30%]', rotate: '-12deg' },
    ]

    // Ambient particles
    const particlePositions = [
        'left-[15%] bottom-[30%]',
        'left-[30%] bottom-[45%]',
        'right-[15%] bottom-[35%]',
        'right-[30%] bottom-[50%]',
        'left-[45%] bottom-[55%]',
        'right-[45%] bottom-[40%]',
        'left-[50%] bottom-[20%]',
        'right-[50%] bottom-[25%]',
    ]

    return (
        <div
            ref={containerRef}
            className="relative w-full max-w-[340px] sm:max-w-[380px] md:max-w-md mx-auto aspect-[4/5] overflow-visible"
        >
            {/* Glow behind stump */}
            <div
                ref={glowRef}
                className="absolute left-1/2 bottom-[15%] -translate-x-1/2 w-[70%] h-[60%] rounded-full pointer-events-none z-0"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(45,212,191,0.15) 0%, rgba(45,212,191,0.05) 40%, transparent 70%)',
                    filter: 'blur(20px)',
                }}
            />

            {/* Obstacles — rise from below */}
            {obstacles.map((obs, i) => (
                <div
                    key={i}
                    ref={el => { obstacleRefs.current[i] = el }}
                    className={`absolute ${obs.pos} ${obs.size} z-10 pointer-events-none`}
                    style={{
                        transform: `rotate(${obs.rotate})`,
                        filter: 'drop-shadow(0 0 8px rgba(45,212,191,0.15))',
                    }}
                >
                    {obs.icon}
                </div>
            ))}

            {/* Central Hero Stump */}
            <img
                ref={stumpRef}
                src={heroStump}
                alt="Cricket Stumps"
                className="absolute left-1/2 bottom-[5%] -translate-x-1/2 w-[55%] sm:w-[50%] h-auto z-20 object-contain"
                style={{
                    filter: 'drop-shadow(0 0 25px rgba(45,212,191,0.25)) drop-shadow(0 8px 20px rgba(0,0,0,0.4))',
                }}
            />

            {/* Ambient floating particles */}
            {particlePositions.map((pos, i) => (
                <div
                    key={`p-${i}`}
                    ref={el => { particleRefs.current[i] = el }}
                    className={`absolute ${pos} z-30 pointer-events-none`}
                >
                    <div
                        className="rounded-full"
                        style={{
                            width: 2 + Math.random() * 3,
                            height: 2 + Math.random() * 3,
                            backgroundColor: i % 3 === 0 ? '#d4a82d' : i % 3 === 1 ? '#2dd4bf' : '#fff',
                            boxShadow: `0 0 6px ${i % 3 === 0 ? '#d4a82d' : '#2dd4bf'}`,
                        }}
                    />
                </div>
            ))}

            {/* Ground line */}
            <div
                className="absolute bottom-[3%] left-[10%] right-[10%] h-[1px] z-5"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.2), rgba(45,212,191,0.3), rgba(45,212,191,0.2), transparent)',
                }}
            />
        </div>
    )
}

export default HeroCricketAnimation
