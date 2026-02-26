export default function CompaniesLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 pt-16 sm:pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-6 w-36 bg-white/10 rounded-full animate-pulse" />
            <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse" />
          </div>
          <div className="h-9 w-64 bg-white/10 rounded-lg animate-pulse mb-3" />
          <div className="h-5 w-96 bg-white/10 rounded animate-pulse" />
          {/* Stats skeleton */}
          <div className="flex items-center gap-6 mt-6 pt-6 border-t border-white/10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-7 w-12 bg-white/10 rounded animate-pulse mb-1" />
                <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters skeleton */}
        <div className="space-y-4 mb-8">
          <div className="flex gap-3">
            <div className="h-12 flex-1 max-w-xl bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            <div className="h-12 w-44 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        {/* Company cards skeleton */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
                <div className="h-5 w-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="h-6 w-8 bg-slate-200 dark:bg-slate-600 rounded animate-pulse mb-1" />
                  <div className="h-2 w-16 bg-slate-200 dark:bg-slate-600 rounded animate-pulse" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="h-6 w-8 bg-slate-200 dark:bg-slate-600 rounded animate-pulse mb-1" />
                  <div className="h-2 w-16 bg-slate-200 dark:bg-slate-600 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
