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
                { y: -20, opacity: 1, scale: 1, duration: 1.2, ease: 'back.out(1.4)', delay: 0.2 }
            )

            // 2. Glow pulse — infinite subtle pulse
            gsap.fromTo(glowRef.current,
                { opacity: 0.3, scale: 0.9 },
                { opacity: 0.6, scale: 1.1, duration: 2.5, ease: 'sine.inOut', repeat: -1, yoyo: true }
            )

            // 3. Image is completely static as requested by user. No floating animation.

            // 4. Floating ambient particles
            const particles = particleRefs.current.filter(Boolean) as HTMLDivElement[]
            particles.forEach((el, i) => {
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
                    }
                )
            })

            // 5. Small abstract obstacles floating out from behind the image
            const obstacles = obstacleRefs.current.filter(Boolean) as HTMLDivElement[]
            obstacles.forEach((el, i) => {
                const angle = 180 + (i * (180 / (obstacles.length - 1)))
                const variance = (Math.random() - 0.5) * 40
                const finalAngle = angle + variance

                const distance = 100 + Math.random() * 100
                const tx = Math.cos((finalAngle * Math.PI) / 180) * distance
                const ty = Math.sin((finalAngle * Math.PI) / 180) * distance

                // Drift outward gently
                gsap.fromTo(el,
                    { x: 0, y: 150, scale: 0, opacity: 0, rotation: 0 },
                    {
                        x: tx,
                        y: ty + 100,
                        scale: 0.5 + Math.random() * 0.8,
                        opacity: 0.8,
                        rotation: (Math.random() - 0.5) * 360,
                        duration: 3 + Math.random() * 2,
                        ease: 'power2.out',
                        delay: 0.5 + i * 0.15,
                        onComplete: () => {
                            // Gentle float
                            gsap.to(el, {
                                y: ty + 80 - Math.random() * 30,
                                rotation: '+=45',
                                duration: 3 + Math.random() * 2,
                                ease: 'sine.inOut',
                                repeat: -1,
                                yoyo: true
                            })
                        }
                    }
                )
            })

        }, containerRef)

        return () => ctx.revert()
    }, [])

    // Ambient particles
    const particlePositions = [
        'left-[15%] bottom-[30%]',
        'left-[35%] bottom-[45%]',
        'right-[15%] bottom-[35%]',
        'right-[35%] bottom-[50%]',
        'left-[45%] bottom-[60%]',
        'right-[45%] bottom-[40%]',
        'left-[50%] top-[20%]',
        'right-[50%] top-[25%]',
        'left-[25%] top-[15%]',
        'right-[25%] top-[20%]',
    ]

    return (
        <div
            ref={containerRef}
            className="relative w-full max-w-[400px] sm:max-w-[500px] md:max-w-[650px] mx-auto aspect-[4/4] overflow-visible flex items-end justify-center pb-0"
        >
            {/* Glow behind the main image */}
            <div
                ref={glowRef}
                className="absolute left-1/2 bottom-[15%] -translate-x-1/2 w-[70%] h-[50%] rounded-full pointer-events-none z-0"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(45,212,191,0.25) 0%, rgba(45,212,191,0.05) 50%, transparent 70%)',
                    filter: 'blur(30px)',
                }}
            />

            {/* Final Sparkle Polish - Dense, micro-sized, and extra bright particles */}
            {Array.from({ length: 64 }).map((_, i) => (
                <div
                    key={`obs-${i}`}
                    ref={el => { obstacleRefs.current[i] = el }}
                    className={`absolute left-1/2 bottom-[40%] -translate-x-1/2 w-[0.5px] h-[0.5px] sm:w-[1px] sm:h-[1px] z-0 pointer-events-none ${i % 3 === 0 ? 'rounded-full' : i % 3 === 1 ? 'rounded-sm' : 'rounded-none rotate-45'} ${i % 4 === 0 ? 'bg-teal-300' : i % 4 === 1 ? 'bg-yellow-200' : i % 4 === 2 ? 'bg-white' : 'bg-emerald-300'}`}
                    style={{
                        filter: `drop-shadow(0 0 3px ${i % 4 === 0 ? 'rgba(94,234,212,0.8)' : i % 4 === 1 ? 'rgba(254,240,138,0.8)' : 'rgba(255,255,255,0.8)'}) brightness(1.5)`,
                        opacity: 0.5 + Math.random() * 0.5
                    }}
                >
                </div>
            ))}

            {/* Central Hero Image - Static, Scaled to bottom, behind curve (z-10) */}
            <img
                ref={stumpRef}
                src={heroStump}
                alt="Cricket Illustration"
                className="relative w-full h-auto z-10 object-contain translate-y-[5%]"
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
