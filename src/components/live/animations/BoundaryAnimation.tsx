import fourIcon from '@/assets/four.png';
import sixIcon from '@/assets/six.png';

export const BoundaryAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none">
            {/* Background Overlay - Golden/Yellow Gradient Pulse */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/90 via-amber-600/80 to-yellow-900/90 animate-pulse-slow backdrop-blur-sm" />

            {/* Radial Burst Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-400/30 via-transparent to-transparent animate-spin-slow opacity-50" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-center animate-scale-in">
                {/* Four Icon with Glow */}
                <div className="relative mb-4 sm:mb-8">
                    <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-40 rounded-full animate-pulse-fast" />
                    <img
                        src={fourIcon}
                        alt="FOUR"
                        className="w-48 h-48 sm:w-64 sm:h-64 object-contain drop-shadow-2xl transform hover:scale-105 transition-transform duration-300"
                    />
                </div>

                {/* Text Effect */}
                <h1 className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] tracking-tighter uppercase animate-bounce-short">
                    Boundary!
                </h1>

                {/* Particles/Sparkles (CSS only) */}
                <div className="absolute inset-0 -z-10 overflow-hidden">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-particle opacity-0"
                            style={{
                                top: '50%',
                                left: '50%',
                                animationDelay: `${i * 0.2}s`,
                                transform: `rotate(${i * 60}deg) translateY(-100px)`
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
