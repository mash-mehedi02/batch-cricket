import Skeleton from '@/components/common/Skeleton';

export default function SquadDetailsSkeleton() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#060b16] pb-20">
            {/* Hero Banner Skeleton */}
            <div className="h-[25vh] bg-slate-900 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
            </div>

            <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
                {/* Header Skeleton */}
                <div className="flex items-end gap-5 mb-8">
                    <Skeleton variant="rounded" className="w-28 h-28 md:w-36 md:h-36 border-4 border-white dark:border-slate-800 shadow-xl" />
                    <div className="pb-2 flex-1 space-y-3">
                        <Skeleton className="h-10 w-3/4 mb-2" />
                        <div className="flex gap-2">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-6 w-40" />
                        </div>
                    </div>
                </div>

                {/* Info Cards Skeleton */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm space-y-2">
                            <Skeleton className="h-3 w-16 mx-auto" />
                            <Skeleton className="h-6 w-12 mx-auto" />
                        </div>
                    ))}
                </div>

                {/* Player Cards Skeleton */}
                <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-3 bg-white dark:bg-[#0f172a] p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                            <Skeleton variant="circle" className="w-12 h-12" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
