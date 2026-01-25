import React, { useEffect, useState, useRef } from 'react'
import fourIcon from '../../assets/four.png'
import sixIcon from '../../assets/six.png'

interface BallEventDisplayProps {
    eventLabel: string
    isWicket: boolean
    ballId?: string
    onAnimationStateChange?: (animating: boolean, eventType: '4' | '6' | 'wicket' | 'normal') => void
}

const BallEventDisplay: React.FC<BallEventDisplayProps> = ({ eventLabel, isWicket, ballId, onAnimationStateChange }) => {
    const [showResult, setShowResult] = useState(false)
    const [animating, setAnimating] = useState(false)
    const prevBallId = useRef(ballId)

    useEffect(() => {
        // Only animate if ballId changes (new ball) and it's not the initial load if possible
        if (ballId && ballId !== prevBallId.current) {
            prevBallId.current = ballId

            // Determine event type for parent
            let eventType: '4' | '6' | 'wicket' | 'normal' = 'normal'
            if (eventLabel === '4') eventType = '4'
            else if (eventLabel === '6') eventType = '6'
            else if (isWicket) eventType = 'wicket'

            setAnimating(true)
            setShowResult(false)
            onAnimationStateChange?.(true, eventType)

            // Show "Bowling..." for 1 second
            const showResultTimer = setTimeout(() => {
                setAnimating(false)
                setShowResult(true)

                // Hide result after 1.5 seconds
                const hideResultTimer = setTimeout(() => {
                    setShowResult(false)
                    onAnimationStateChange?.(false, eventType)
                }, 1500)

                return () => clearTimeout(hideResultTimer)
            }, 1000)

            return () => clearTimeout(showResultTimer)
        } else {
            // Initial render or same ball - just show result
            if (!animating) {
                setShowResult(true)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ballId])

    // If nothing interesting is happening, just show the label statically
    if (!ballId) {
        return (
            <div className="text-white font-bold text-4xl">
                {eventLabel}
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center h-full w-full relative z-[10000]">
            {animating && (
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-4 w-4 bg-white rounded-full animate-bounce mb-2"></div>
                    <span className="text-white text-xs uppercase font-bold tracking-widest">Bowling...</span>
                </div>
            )}

            {!animating && showResult && (
                <div className="animate-scale-in flex items-center justify-center">
                    {eventLabel === '4' ? (
                        <img src={fourIcon} alt="4 Runs" className="h-24 md:h-32 object-contain drop-shadow-lg animate-bounce-short" />
                    ) : eventLabel === '6' ? (
                        <img src={sixIcon} alt="6 Runs" className="h-24 md:h-32 object-contain drop-shadow-lg animate-bounce-short" />
                    ) : isWicket ? (
                        <div className="bg-red-600/90 text-white px-6 py-2 rounded-xl text-4xl font-black uppercase tracking-wider shadow-lg border-2 border-red-400 animate-pulse-fast">
                            {eventLabel}
                        </div>
                    ) : (
                        <div className="text-white font-bold text-6xl drop-shadow-md font-mono">
                            {eventLabel}
                        </div>
                    )}
                </div>
            )}

            {/* Show nothing when animation is complete */}
            {!animating && !showResult && (
                <div className="text-white font-bold text-4xl">
                    {eventLabel}
                </div>
            )}
        </div>
    )
}

export default BallEventDisplay
