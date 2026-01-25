import sixIcon from '@/assets/six.png';

export const SixAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none">
            <style>
                {`
          @keyframes shake {
            0%, 100% { transform: translateX(0) scale(1); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px) scale(1.05); }
            20%, 40%, 60%, 80% { transform: translateX(5px) scale(1.05); }
          }
          .animate-shake-hard {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
          }
        `}
            </style>

            {/* Background Overlay - Orange -> Gold Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900/90 via-red-600/80 to-amber-600/90 animate-pulse-slow backdrop-blur-md" />

            {/* Explosive Burst */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/40 via-transparent to-transparent animate-pulse-fast opacity-70" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-center">
                {/* Six Icon with Power Glow */}
                <div className="relative mb-4 sm:mb-8 animate-shake-hard">
                    <div className="absolute inset-0 bg-orange-500 blur-3xl opacity-50 rounded-full animate-pulse" />
                    <img
                        src={sixIcon}
                        alt="SIX"
                        className="w-56 h-56 sm:w-72 sm:h-72 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                    />
                </div>

                {/* Text Effect */}
                <h1 className="text-7xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-orange-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] tracking-tighter uppercase animate-in slide-in-from-bottom-4 duration-500">
                    MAXIMUM!
                </h1>

                {/* Shockwaves */}
                <div className="absolute inset-0 -z-10 flex items-center justify-center">
                    <div className="w-full h-full max-w-sm max-h-sm border-4 border-orange-400/30 rounded-full animate-ping" />
                    <div className="absolute w-2/3 h-2/3 border-4 border-yellow-400/20 rounded-full animate-ping delay-100" />
                </div>
            </div>
        </div>
    );
};
