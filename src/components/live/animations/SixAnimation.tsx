import sixIcon from '@/assets/six.png';

export const SixAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none">
            {/* Elegant Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-orange-950/90 to-slate-950/95 backdrop-blur-sm" />

            {/* Radial Accent Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-500/15 via-transparent to-transparent" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-8 animate-in fade-in zoom-in-95 duration-500">
                {/* Six Icon - Premium Display */}
                <div className="relative">
                    <div className="absolute inset-0 bg-orange-500/25 blur-3xl rounded-full animate-pulse" />
                    <img
                        src={sixIcon}
                        alt="SIX"
                        className="w-40 h-40 sm:w-48 sm:h-48 object-contain drop-shadow-[0_0_40px_rgba(249,115,22,0.5)]"
                    />
                </div>

                {/* Refined Typography */}
                <div className="flex flex-col items-center gap-3">
                    <h1 className="text-8xl sm:text-9xl font-black text-white drop-shadow-lg tracking-tight">
                        SIX
                    </h1>
                    <div className="h-1 w-32 bg-gradient-to-r from-transparent via-orange-500 to-transparent rounded-full animate-pulse" />
                    <p className="text-xl sm:text-2xl text-slate-300 font-medium tracking-wide uppercase">
                        Maximum
                    </p>
                </div>

                {/* Subtle Ring Effect */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-96 h-96 border border-orange-500/20 rounded-full animate-ping" />
                </div>
            </div>
        </div>
    );
};
