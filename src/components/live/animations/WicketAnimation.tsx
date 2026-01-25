import stumpsIcon from '@/assets/hero_stumps.png';

export const WicketAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none">
            {/* Background Overlay - Dark Red/Maroon Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-950/95 via-red-900/90 to-black/90 animate-pulse-slow backdrop-blur-sm" />

            {/* Red Alert Flash */}
            <div className="absolute inset-0 bg-red-500/10 animate-pulse-fast mix-blend-overlay" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
                {/* Wicket Graphic */}
                <div className="relative mb-6 sm:mb-10">
                    <div className="absolute inset-0 bg-red-600 blur-[60px] opacity-30 rounded-full" />
                    <img
                        src={stumpsIcon}
                        alt="WICKET"
                        className="w-48 h-48 sm:w-64 sm:h-64 object-contain drop-shadow-[0_10px_30px_rgba(220,38,38,0.5)] grayscale-[0.2] contrast-125"
                    />
                </div>

                {/* Text Effect */}
                <div className="flex flex-col items-center">
                    <h1 className="text-7xl sm:text-9xl font-black text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-tighter uppercase mb-2">
                        WICKET
                    </h1>
                    <div className="w-1/2 h-1 bg-red-500 rounded-full animate-pulse" />
                    <h2 className="text-xl sm:text-2xl font-bold text-red-400 mt-2 tracking-[0.5em] uppercase opacity-90">
                        Batter Out
                    </h2>
                </div>

                {/* Cracks / Shatter Effect (Simulated with lines) */}
                <div className="absolute inset-0 -z-10 rotate-45 opacity-20">
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white transform -rotate-12" />
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white transform rotate-12" />
                </div>
            </div>
        </div>
    );
};
