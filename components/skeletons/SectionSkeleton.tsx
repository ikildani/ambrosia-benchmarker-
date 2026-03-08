/** Reusable skeleton for below-fold result sections (charts, sensitivity, panels). */
export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 sm:p-6 animate-pulse">
      <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-1/4 mb-4" />
      <div className="h-56 bg-neutral-50 dark:bg-slate-700/50 rounded-lg" />
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 sm:p-6 animate-pulse">
      <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
      <div className="space-y-2.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-neutral-50 dark:bg-slate-700/50 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function AnalysisPanelSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 sm:p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-neutral-200 dark:bg-slate-700 rounded-xl" />
        <div className="h-5 bg-neutral-200 dark:bg-slate-700 rounded w-1/3" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded w-full" />
        <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded w-5/6" />
        <div className="h-4 bg-neutral-100 dark:bg-slate-700 rounded w-3/4" />
      </div>
    </div>
  );
}
