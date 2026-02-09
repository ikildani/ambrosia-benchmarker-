export default function ResultsSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg">
      {/* Header bar skeleton */}
      <div className="bg-navy-900 dark:bg-navy-950 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton dark:bg-slate-700 w-8 h-8 rounded-full" />
            <div>
              <div className="skeleton dark:bg-slate-700 h-5 w-48 mb-2" />
              <div className="skeleton dark:bg-slate-700 h-3 w-32" />
            </div>
          </div>
          <div className="skeleton dark:bg-slate-700 h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Metric cards grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="skeleton dark:bg-slate-700 h-3 w-24" />
                <div className="skeleton dark:bg-slate-700 h-5 w-16 rounded-full" />
              </div>
              <div className="skeleton dark:bg-slate-700 h-7 w-40 mb-2" />
              <div className="skeleton dark:bg-slate-700 h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 border border-slate-100 dark:border-slate-700 mb-6">
          <div className="skeleton dark:bg-slate-700 h-5 w-36 mb-4" />
          <div className="skeleton dark:bg-slate-700 h-48 w-full rounded-lg" />
        </div>

        {/* Methodology accordion placeholder */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="skeleton dark:bg-slate-700 h-4 w-44" />
            <div className="skeleton dark:bg-slate-700 h-4 w-4 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
