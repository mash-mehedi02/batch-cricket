import stumpsIcon from '@/assets/hero_stumps.png';

export const WicketAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none">
            {/* Sophisticated Dark Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-red-950/90 to-slate-950/95 backdrop-blur-sm" />

            {/* Subtle Red Accent Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-600/15 via-transparent to-transparent" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-8 animate-in fade-in zoom-in-95 duration-500">
                {/* Wicket Icon - Clean & Centered */}
                <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
                    <img
                        src={stumpsIcon}
                        alt="WICKET"
                        className="w-36 h-36 sm:w-44 sm:h-44 object-contain drop-shadow-[0_0_35px_rgba(220,38,38,0.4)] grayscale-[0.1]"
                    />
                </div>

                {/* Modern Typography */}
                <div className="flex flex-col items-center gap-3">
                    <h1 className="text-7xl sm:text-8xl font-black text-white drop-shadow-lg tracking-tight">
                        WICKET
                    </h1>
                    <div className="h-1 w-28 bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full" />
                    <p className="text-lg sm:text-xl text-slate-300 font-medium tracking-wide uppercase">
                        Batter Out
                    </p>
                </div>
            </div>
        </div>
    );
};
