import fourIcon from '@/assets/four.png';

export const BoundaryAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none">
            {/* Subtle Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-sm" />

            {/* Subtle Glow Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-8 animate-in fade-in zoom-in-95 duration-500">
                {/* Four Icon - Clean & Centered */}
                <div className="relative">
                    <div className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full" />
                    <img
                        src={fourIcon}
                        alt="FOUR"
                        className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-[0_0_30px_rgba(234,179,8,0.4)]"
                    />
                </div>

                {/* Clean Typography */}
                <div className="flex flex-col items-center gap-3">
                    <h1 className="text-7xl sm:text-8xl font-black text-white drop-shadow-lg tracking-tight">
                        FOUR
                    </h1>
                    <div className="h-1 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent rounded-full" />
                    <p className="text-lg sm:text-xl text-slate-300 font-medium tracking-wide uppercase">
                        Boundary
                    </p>
                </div>
            </div>
        </div>
    );
};
