/**
 * HeroCricketAnimation — GSAP-powered stump & player animation
 * A cinematic hero composite image rising from the center.
 * Zero lag, GPU-accelerated via GSAP.
 */

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import heroStump from '@/assets/hero_stumps.png'

const HeroCricketAnimation = () => {
    const containerRef = useRef<HTMLDivElement>(null)
    const stumpRef = useRef<HTMLImageElement>(null)
    const glowRef = useRef<HTMLDivElement>(null)
    const particleRefs = useRef<(HTMLDivElement | null)[]>([])
    const obstacleRefs = useRef<(HTMLDivElement | null)[]>([])

    useEffect(() => {
        if (!containerRef.current) return

        const ctx = gsap.context(() => {
            // 1. Image entrance — scale up from center with spring
            gsap.fromTo(stumpRef.current,
                { y: 80, opacity: 0, scale: 0.6 },
                { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: 'back.out(1.4)', delay: 0.2, force3D: true }
            )

            // 2. Glow pulse — simplified with opacity only
            gsap.fromTo(glowRef.current,
                { opacity: 0.3 },
                { opacity: 0.5, duration: 2.5, ease: 'sine.inOut', repeat: -1, yoyo: true, force3D: true }
            )

            // 3. Floating ambient particles - optimized
            const particles = particleRefs.current.filter(Boolean) as HTMLDivElement[]
            particles.forEach((el) => {
                gsap.fromTo(el,
                    { opacity: 0, y: 20 },
                    {
                        opacity: 0.6,
                        y: -40 - Math.random() * 40,
                        x: (Math.random() - 0.5) * 40,
                        duration: 3 + Math.random() * 3,
                        ease: 'sine.inOut',
                        repeat: -1,
                        yoyo: true,
                        delay: Math.random() * 2,
                        force3D: true
                    }
                )
            })

            // 4. Small abstract obstacles - reduced and simplified
            const obstacles = obstacleRefs.current.filter(Boolean) as HTMLDivElement[]
            obstacles.forEach((el, i) => {
                const angle = 180 + (i * (180 / (obstacles.length - 1)))
                const variance = (Math.random() - 0.5) * 40
                const finalAngle = angle + variance

                const distance = 80 + Math.random() * 80
                const tx = Math.cos((finalAngle * Math.PI) / 180) * distance
                const ty = Math.sin((finalAngle * Math.PI) / 180) * distance

                gsap.fromTo(el,
                    { x: 0, y: 150, scale: 0, opacity: 0 },
                    {
                        x: tx,
                        y: ty + 80,
                        scale: 0.5 + Math.random() * 0.5,
                        opacity: 0.7,
                        duration: 2.5 + Math.random() * 1.5,
                        ease: 'power2.out',
                        delay: 0.3 + i * 0.1,
                        force3D: true,
                        onComplete: () => {
                            if (!el) return;
                            gsap.to(el, {
                                y: ty + 70 - Math.random() * 20,
                                duration: 3 + Math.random() * 2,
                                ease: 'sine.inOut',
                                repeat: -1,
                                yoyo: true,
                                force3D: true
                            })
                        }
                    }
                )
            })

        }, containerRef.current || undefined)

        return () => ctx.revert()
    }, [])

    // Ambient particles - reduced count
    const particlePositions = [
        'left-[25%] bottom-[35%]',
        'right-[25%] bottom-[40%]',
        'left-[45%] bottom-[55%]',
        'right-[45%] bottom-[45%]',
        'left-[50%] top-[25%]',
    ]

    return (
        <div
            ref={containerRef}
            className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-[400px] mx-auto aspect-square overflow-visible flex items-end justify-center pb-0"
        >
            {/* Glow behind the main image - removed expensive filters */}
            <div
                ref={glowRef}
                className="absolute left-1/2 bottom-[15%] -translate-x-1/2 w-[70%] h-[50%] rounded-full pointer-events-none z-0"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(45,212,191,0.2) 0%, transparent 70%)',
                }}
            />

            {/* Reduced and simplified sparkle particles */}
            {Array.from({ length: 24 }).map((_, i) => (
                <div
                    key={`obs-${i}`}
                    ref={el => { obstacleRefs.current[i] = el }}
                    className={`absolute left-1/2 bottom-[40%] -translate-x-1/2 w-[1px] h-[1px] z-0 pointer-events-none rounded-full ${i % 3 === 0 ? 'bg-teal-400' : i % 3 === 1 ? 'bg-yellow-200' : 'bg-white'}`}
                    style={{
                        opacity: 0.6
                    }}
                >
                </div>
            ))}

            {/* Central Hero Image - Static, Scaled to bottom, behind curve (z-10) */}
            <img
                ref={stumpRef}
                src={heroStump}
                alt="Cricket Illustration"
                className="relative w-[85%] h-auto z-10 object-contain translate-y-0"
                style={{
                    filter: 'drop-shadow(0 0 35px rgba(45,212,191,0.25)) drop-shadow(0 15px 30px rgba(0,0,0,0.6))',
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
                            width: 2.5 + Math.random() * 4,
                            height: 2.5 + Math.random() * 4,
                            backgroundColor: i % 3 === 0 ? '#d4a82d' : i % 3 === 1 ? '#2dd4bf' : '#fff',
                            boxShadow: `0 0 8px ${i % 3 === 0 ? '#d4a82d' : '#2dd4bf'}`,
                        }}
                    />
                </div>
            ))}
        </div>
    )
}

export default HeroCricketAnimation
