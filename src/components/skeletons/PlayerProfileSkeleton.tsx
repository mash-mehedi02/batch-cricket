import Skeleton from '@/components/common/Skeleton';

export default function PlayerProfileSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b16]">
      {/* Header Skeleton */}
      <div className="bg-slate-950 h-[380px] relative overflow-hidden">
        {/* Profile Card Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center">
          <Skeleton variant="circle" className="w-32 h-32 border-4 border-white/10 mb-4" />
          <Skeleton className="w-48 h-8 mb-2" />
          <Skeleton className="w-24 h-4" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-white/5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 py-4 px-2">
              <Skeleton className="w-full h-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="bg-white dark:bg-[#0f172a] rounded-3xl p-6 border border-slate-100 dark:border-white/5 space-y-6">
          <Skeleton className="w-40 h-6 mb-4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton variant="circle" className="w-12 h-12" />
                <Skeleton className="w-10 h-3" />
              </div>
            ))}
          </div>
        </div>

        {/* Matches Skeleton */}
        <div className="space-y-4">
          <Skeleton className="w-32 h-6" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" className="w-10 h-10" />
                <div className="space-y-2">
                  <Skeleton className="w-24 h-4" />
                  <Skeleton className="w-16 h-3" />
                </div>
              </div>
              <Skeleton variant="rounded" className="w-16 h-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
