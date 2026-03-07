export default function ResultsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header gradient skeleton */}
      <div className="rounded-2xl bg-gradient-to-r from-neutral-200 to-neutral-100 dark:from-slate-700 dark:to-slate-600 h-32" />

      {/* Deal structure bar skeleton */}
      <div className="h-12 bg-neutral-100 dark:bg-slate-700 rounded-xl" />

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 space-y-3">
            <div className="h-3 bg-neutral-100 dark:bg-slate-700 rounded w-2/3" />
            <div className="h-7 bg-neutral-200 dark:bg-slate-600 rounded w-full" />
            <div className="h-3 bg-neutral-100 dark:bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>

      {/* Chart area skeleton */}
      <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-6">
        <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded w-1/4 mb-4" />
        <div className="h-48 bg-neutral-50 dark:bg-slate-700/50 rounded-lg" />
      </div>

      {/* Sensitivity / Comparable deals skeleton */}
      <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-6">
        <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-neutral-50 dark:bg-slate-700/50 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Deal memo skeleton */}
      <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-6">
        <div className="h-5 bg-neutral-200 dark:bg-slate-600 rounded w-1/4 mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded w-full" />
          <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded w-5/6" />
          <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded w-4/6" />
        </div>
      </div>
    </div>
  );
}
