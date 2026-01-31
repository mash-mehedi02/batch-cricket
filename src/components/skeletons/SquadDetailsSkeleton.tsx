/**
 * Squad Details Skeleton Loader
 * Lightweight skeleton matching the actual page layout
 */

export default function SquadDetailsSkeleton() {
    return (
        <div className="min-h-screen bg-white pb-20 animate-pulse">
            {/* Hero Banner Skeleton */}
            <div className="h-[20vh] md:h-[30vh] bg-slate-200" />

            <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
                {/* Header Skeleton */}
                <div className="flex items-end gap-5 mb-8">
                    <div className="w-28 h-28 md:w-36 md:h-36 bg-white rounded-3xl border-4 border-white shadow-xl" />
                    <div className="pb-2 flex-1 space-y-3">
                        <div className="h-10 bg-slate-200 rounded-xl w-3/4" />
                        <div className="flex gap-2">
                            <div className="h-6 w-24 bg-emerald-100 rounded" />
                            <div className="h-6 w-40 bg-slate-100 rounded" />
                        </div>
                    </div>
                </div>

                {/* Tabs Skeleton */}
                <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl mb-6 w-fit">
                    <div className="h-10 w-24 bg-emerald-200 rounded-lg" />
                    <div className="h-10 w-24 bg-slate-100 rounded-lg" />
                    <div className="h-10 w-32 bg-slate-100 rounded-lg" />
                </div>

                {/* Info Cards Skeleton */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                            <div className="h-3 bg-slate-100 rounded w-16 mx-auto mb-2" />
                            <div className="h-6 bg-slate-200 rounded-lg w-12 mx-auto" />
                        </div>
                    ))}
                </div>

                {/* Player Cards Skeleton */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-2 sm:gap-4 bg-slate-50/50 p-2 sm:p-3 rounded-2xl border border-slate-100">
                            <div className="w-12 h-12 bg-slate-200 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-3/4" />
                                <div className="h-3 bg-slate-100 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
