export default function CalculatorLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        </div>
        {/* Wizard progress */}
        <div className="flex items-center gap-3 mb-8 max-w-lg mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Form skeleton */}
        <div className="max-w-2xl mx-auto space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            </div>
          ))}
          <div className="h-12 w-full bg-teal-200 dark:bg-teal-900/30 rounded-xl animate-pulse mt-8" />
        </div>
      </div>
    </div>
  );
}
