import Skeleton from '@/components/common/Skeleton';

export default function MatchCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 p-5 flex flex-col gap-4">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <Skeleton variant="circle" className="w-8 h-8" />
          <div className="space-y-1.5">
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-16 h-2" />
          </div>
        </div>
        <Skeleton variant="rounded" className="w-16 h-6" />
      </div>

      {/* Main Score Area */}
      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="w-32 h-6" />
            <Skeleton className="w-20 h-3" />
          </div>
          <Skeleton variant="circle" className="w-12 h-12" />
        </div>

        {/* Progress Bar Skeleton */}
        <Skeleton variant="rounded" className="w-full h-1.5" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <div className="space-y-2">
          <Skeleton className="w-full h-2" />
          <Skeleton className="w-10 h-3" />
        </div>
        <div className="space-y-2">
          <Skeleton className="w-full h-2" />
          <Skeleton className="w-10 h-3" />
        </div>
        <div className="space-y-2">
          <Skeleton className="w-full h-2" />
          <Skeleton className="w-10 h-3" />
        </div>
      </div>
    </div>
  );
}
