import Skeleton from '@/components/common/Skeleton';

export default function RankingsSkeleton() {
    return (
        <div className="space-y-6">
            {/* Podium Skeleton */}
            <div className="flex items-end justify-center gap-4 mb-12 mt-4 px-2">
                {/* 2nd */}
                <div className="flex-1 max-w-[120px] flex flex-col items-center gap-3">
                    <Skeleton variant="circle" className="w-16 h-16 sm:w-20 h-20" />
                    <Skeleton className="w-full h-3" />
                    <Skeleton className="w-10 h-4" />
                </div>
                {/* 1st */}
                <div className="flex-1 max-w-[140px] flex flex-col items-center gap-4 -translate-y-4">
                    <Skeleton variant="circle" className="w-20 h-20 sm:w-24 h-24" />
                    <Skeleton className="w-full h-4" />
                    <Skeleton className="w-12 h-5 text-amber-500" />
                </div>
                {/* 3rd */}
                <div className="flex-1 max-w-[120px] flex flex-col items-center gap-3">
                    <Skeleton variant="circle" className="w-16 h-16 sm:w-20 h-20" />
                    <Skeleton className="w-full h-3" />
                    <Skeleton className="w-10 h-4" />
                </div>
            </div>

            {/* List Skeleton */}
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                        <Skeleton className="w-5 h-4" />
                        <Skeleton variant="circle" className="w-10 h-10" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="w-32 h-4" />
                            <Skeleton className="w-20 h-2" />
                        </div>
                        <div className="text-right space-y-1">
                            <Skeleton className="w-12 h-5 ml-auto" />
                            <Skeleton className="w-8 h-2 ml-auto" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
